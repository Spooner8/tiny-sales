use std::str::FromStr;

use sqlx::{FromRow, Sqlite, SqlitePool, Transaction};

use crate::error::AppError;
use crate::features::open_sale::repository::OpenSaleRepository;

use super::model::{
    ArticleRevenue, DailyRevenue, PaymentMethod, PreparedSale, ProductGroupRevenue, Sale,
    SaleItemDetail, SaleListEntry, SaleWithItems,
};

/// Raw DB row: payment_method comes out of SQLite as TEXT and is only
/// translated into the domain enum here (at the persistence boundary).
#[derive(FromRow)]
struct SaleRow {
    id: i64,
    timestamp: String,
    payment_method: String,
    status: String,
    subtotal_cents: i64,
    discount_cents: i64,
    discount_percent: Option<f64>,
    discount_kind: Option<String>,
    discount_cumulative: Option<bool>,
    total_cents: i64,
    pickup_number: Option<String>,
    cash_given_cents: Option<i64>,
    change_cents: Option<i64>,
    vat_rate_percent: Option<f64>,
    vat_cents: Option<i64>,
    customer_order_id: Option<i64>,
    customer_name: Option<String>,
    customer_company: Option<String>,
    invoice_id: Option<i64>,
    invoice_paid_on: Option<String>,
}

impl SaleRow {
    fn into_domain(self) -> Result<Sale, AppError> {
        Ok(Sale {
            id: self.id,
            timestamp: self.timestamp,
            payment_method: PaymentMethod::from_str(&self.payment_method)?,
            status: self.status,
            subtotal_cents: self.subtotal_cents,
            discount_cents: self.discount_cents,
            discount_percent: self.discount_percent,
            discount_kind: self.discount_kind,
            discount_cumulative: self.discount_cumulative,
            total_cents: self.total_cents,
            pickup_number: self.pickup_number,
            cash_given_cents: self.cash_given_cents,
            change_cents: self.change_cents,
            vat_rate_percent: self.vat_rate_percent,
            vat_cents: self.vat_cents,
            customer_order_id: self.customer_order_id,
            customer_name: self.customer_name,
            customer_company: self.customer_company,
            invoice_id: self.invoice_id,
            invoice_paid_on: self.invoice_paid_on,
        })
    }
}

#[derive(FromRow)]
struct SaleListRow {
    sale_id: i64,
    return_id: Option<i64>,
    timestamp: String,
    payment_method: String,
    total_cents: i64,
    pickup_number: Option<String>,
    customer_name: Option<String>,
    customer_company: Option<String>,
    invoice_id: Option<i64>,
    invoice_paid_on: Option<String>,
}

impl SaleListRow {
    fn into_domain(self) -> Result<SaleListEntry, AppError> {
        Ok(SaleListEntry {
            sale_id: self.sale_id,
            return_id: self.return_id,
            timestamp: self.timestamp,
            payment_method: PaymentMethod::from_str(&self.payment_method)?,
            total_cents: self.total_cents,
            pickup_number: self.pickup_number,
            customer_name: self.customer_name,
            customer_company: self.customer_company,
            invoice_id: self.invoice_id,
            invoice_paid_on: self.invoice_paid_on,
        })
    }
}

/// Customer and invoice of sales that completed a customer order.
const SALE_ORDER_JOINS: &str = "
    LEFT JOIN customer_order ON customer_order.sale_id = sale.id
    LEFT JOIN customer ON customer.id = customer_order.customer_id
    LEFT JOIN invoice ON invoice.sale_id = sale.id";

pub const CUSTOMER_NAME_SQL: &str =
    "CASE WHEN customer.id IS NULL THEN NULL ELSE customer.first_name || ' ' || customer.last_name END";

pub struct SaleRepository;

impl SaleRepository {
    /// Inserts the sale and its items in one transaction and decrements
    /// article stock accordingly. Selling more than the recorded stock means
    /// the stock was wrong: it is corrected up to the sold quantity and then
    /// deducted, i.e. it ends at 0 instead of going negative. The open sale it
    /// was rung up in (and with it the stock reservation) is deleted in the
    /// same transaction.
    pub async fn create(pool: &SqlitePool, prepared: &PreparedSale) -> Result<SaleWithItems, AppError> {
        let mut tx = pool.begin().await?;
        let sale_id = Self::create_in(&mut tx, prepared).await?;
        tx.commit().await?;

        Self::find_with_items(pool, sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Verkauf {sale_id} nach dem Anlegen nicht gefunden")))
    }

    /// Like `create`, inside the caller's transaction; returns the sale id.
    pub async fn create_in(tx: &mut Transaction<'_, Sqlite>, prepared: &PreparedSale) -> Result<i64, AppError> {
        let sale_id = sqlx::query(
            "INSERT INTO sale (payment_method, status, subtotal_cents, discount_cents, discount_percent, discount_kind, discount_cumulative, total_cents, pickup_number, cash_given_cents, change_cents, vat_rate_percent, vat_cents)
             VALUES (?, 'Completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(prepared.payment_method.as_str())
        .bind(prepared.subtotal_cents)
        .bind(prepared.discount_cents)
        .bind(prepared.discount_percent)
        .bind(prepared.discount_kind)
        .bind(prepared.discount_cumulative)
        .bind(prepared.total_cents)
        .bind(&prepared.pickup_number)
        .bind(prepared.cash_given_cents)
        .bind(prepared.change_cents)
        .bind(prepared.vat_rate_percent)
        .bind(prepared.vat_cents)
        .execute(&mut **tx)
        .await?
        .last_insert_rowid();

        for item in &prepared.items {
            sqlx::query(
                "INSERT INTO sale_item (sale_id, article_id, quantity, list_price_cents, unit_price_cents, article_discount_percent,
                                        line_discount_kind, line_discount_value, discount_cents, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(sale_id)
            .bind(item.article_id)
            .bind(item.quantity)
            .bind(item.list_price_cents)
            .bind(item.unit_price_cents)
            .bind(item.article_discount_percent)
            .bind(item.line_discount_kind)
            .bind(item.line_discount_value)
            .bind(item.discount_cents)
            .bind(&item.note)
            .execute(&mut **tx)
            .await?;

            sqlx::query("UPDATE article SET stock = MAX(stock - ?, 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(item.quantity)
                .bind(item.article_id)
                .execute(&mut **tx)
                .await?;
        }

        if let Some(open_sale_id) = &prepared.open_sale_id {
            OpenSaleRepository::delete_in(tx, open_sale_id).await?;
        }

        Ok(sale_id)
    }

    /// Sales and returns in the date range, newest first. Each return is its
    /// own entry on the day it was booked, with the refund as a negative
    /// total, like the revenue statistics count it.
    pub async fn list(pool: &SqlitePool, from: &str, to: &str) -> Result<Vec<SaleListEntry>, AppError> {
        let rows = sqlx::query_as::<_, SaleListRow>(&format!(
            "SELECT sale.id as sale_id, NULL as return_id, sale.timestamp as timestamp, sale.payment_method as payment_method,
                    sale.total_cents as total_cents, sale.pickup_number as pickup_number,
                    {CUSTOMER_NAME_SQL} as customer_name, customer.company as customer_company,
                    invoice.id as invoice_id, invoice.paid_on as invoice_paid_on
             FROM sale {SALE_ORDER_JOINS}
             WHERE date(sale.timestamp) BETWEEN ?1 AND ?2
             UNION ALL
             SELECT sale_return.sale_id, sale_return.id, sale_return.timestamp, sale_return.refund_method,
                    -sale_return.total_refund_cents, NULL, {CUSTOMER_NAME_SQL}, customer.company, NULL, NULL
             FROM sale_return
             LEFT JOIN customer_order ON customer_order.sale_id = sale_return.sale_id
             LEFT JOIN customer ON customer.id = customer_order.customer_id
             WHERE date(sale_return.timestamp) BETWEEN ?1 AND ?2
             ORDER BY timestamp DESC, return_id DESC"
        ))
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(SaleListRow::into_domain).collect()
    }

    pub async fn find_with_items(pool: &SqlitePool, id: i64) -> Result<Option<SaleWithItems>, AppError> {
        let Some(sale) = Self::find_sale(pool, id).await? else {
            return Ok(None);
        };
        let items = Self::find_items(pool, id).await?;
        Ok(Some(SaleWithItems { sale, items }))
    }

    async fn find_sale(pool: &SqlitePool, id: i64) -> Result<Option<Sale>, AppError> {
        let row = sqlx::query_as::<_, SaleRow>(&format!(
            "SELECT sale.id as id, sale.timestamp as timestamp, sale.payment_method as payment_method, sale.status as status,
                    sale.subtotal_cents as subtotal_cents, sale.discount_cents as discount_cents,
                    sale.discount_percent as discount_percent, sale.discount_kind as discount_kind,
                    sale.discount_cumulative as discount_cumulative, sale.total_cents as total_cents,
                    sale.pickup_number as pickup_number, sale.cash_given_cents as cash_given_cents,
                    sale.change_cents as change_cents, sale.vat_rate_percent as vat_rate_percent,
                    sale.vat_cents as vat_cents, customer_order.id as customer_order_id,
                    {CUSTOMER_NAME_SQL} as customer_name, customer.company as customer_company,
                    invoice.id as invoice_id, invoice.paid_on as invoice_paid_on
             FROM sale {SALE_ORDER_JOINS}
             WHERE sale.id = ?"
        ))
        .bind(id)
        .fetch_optional(pool)
        .await?;
        row.map(SaleRow::into_domain).transpose()
    }

    async fn find_items(pool: &SqlitePool, sale_id: i64) -> Result<Vec<SaleItemDetail>, AppError> {
        let items = sqlx::query_as::<_, SaleItemDetail>(
            "SELECT sale_item.article_id as article_id, article.code as article_code, article.name as article_name,
                    article.internal_number as article_internal_number,
                    sale_item.quantity as quantity, sale_item.list_price_cents as list_price_cents,
                    sale_item.unit_price_cents as unit_price_cents,
                    sale_item.article_discount_percent as article_discount_percent,
                    sale_item.line_discount_kind as line_discount_kind,
                    sale_item.line_discount_value as line_discount_value,
                    (sale_item.quantity * sale_item.unit_price_cents) as line_total_cents,
                    sale_item.discount_cents as discount_cents, sale_item.note as note
             FROM sale_item JOIN article ON sale_item.article_id = article.id
             WHERE sale_item.sale_id = ?
             ORDER BY sale_item.id",
        )
        .bind(sale_id)
        .fetch_all(pool)
        .await?;
        Ok(items)
    }

    /// Net revenue = what was paid (after all discounts) minus refunds, each
    /// counted on the day they actually happened (a return booked today
    /// reduces today's figure, not the day of the original sale).
    pub async fn revenue_by_day(pool: &SqlitePool, from: &str, to: &str) -> Result<Vec<DailyRevenue>, AppError> {
        let rows = sqlx::query_as::<_, DailyRevenue>(
            "SELECT day, SUM(amount_cents) as total_cents FROM (
                SELECT date(sale.timestamp) as day, (sale_item.quantity * sale_item.unit_price_cents - sale_item.discount_cents) as amount_cents
                FROM sale_item JOIN sale ON sale_item.sale_id = sale.id
                WHERE date(sale.timestamp) BETWEEN ?1 AND ?2
                UNION ALL
                SELECT date(sale_return.timestamp) as day, -sale_return_item.refund_cents as amount_cents
                FROM sale_return_item JOIN sale_return ON sale_return_item.sale_return_id = sale_return.id
                WHERE date(sale_return.timestamp) BETWEEN ?1 AND ?2
             )
             GROUP BY day ORDER BY day",
        )
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn revenue_by_product_group(
        pool: &SqlitePool,
        from: &str,
        to: &str,
    ) -> Result<Vec<ProductGroupRevenue>, AppError> {
        let rows = sqlx::query_as::<_, ProductGroupRevenue>(
            "SELECT product_group_id, product_group_name, SUM(amount_cents) as total_cents FROM (
                SELECT product_group.id as product_group_id, product_group.name as product_group_name,
                       (sale_item.quantity * sale_item.unit_price_cents - sale_item.discount_cents) as amount_cents
                FROM sale_item
                JOIN sale ON sale_item.sale_id = sale.id
                JOIN article ON sale_item.article_id = article.id
                JOIN product_group ON article.product_group_id = product_group.id
                WHERE date(sale.timestamp) BETWEEN ?1 AND ?2
                UNION ALL
                SELECT product_group.id as product_group_id, product_group.name as product_group_name,
                       -sale_return_item.refund_cents as amount_cents
                FROM sale_return_item
                JOIN sale_return ON sale_return_item.sale_return_id = sale_return.id
                JOIN article ON sale_return_item.article_id = article.id
                JOIN product_group ON article.product_group_id = product_group.id
                WHERE date(sale_return.timestamp) BETWEEN ?1 AND ?2
             )
             GROUP BY product_group_id, product_group_name
             ORDER BY total_cents DESC",
        )
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn revenue_by_article(
        pool: &SqlitePool,
        from: &str,
        to: &str,
    ) -> Result<Vec<ArticleRevenue>, AppError> {
        let rows = sqlx::query_as::<_, ArticleRevenue>(
            "SELECT article_id, article_name, SUM(amount_cents) as total_cents FROM (
                SELECT article.id as article_id, article.name as article_name,
                       (sale_item.quantity * sale_item.unit_price_cents - sale_item.discount_cents) as amount_cents
                FROM sale_item
                JOIN sale ON sale_item.sale_id = sale.id
                JOIN article ON sale_item.article_id = article.id
                WHERE date(sale.timestamp) BETWEEN ?1 AND ?2
                UNION ALL
                SELECT article.id as article_id, article.name as article_name,
                       -sale_return_item.refund_cents as amount_cents
                FROM sale_return_item
                JOIN sale_return ON sale_return_item.sale_return_id = sale_return.id
                JOIN article ON sale_return_item.article_id = article.id
                WHERE date(sale_return.timestamp) BETWEEN ?1 AND ?2
             )
             GROUP BY article_id, article_name
             ORDER BY total_cents DESC
             LIMIT 15",
        )
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_are_listed_as_negative_entries() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();
            sqlx::raw_sql(
                "INSERT INTO sale (id, timestamp, payment_method, status, subtotal_cents, total_cents, pickup_number)
                     VALUES (7, '2026-03-01 10:00:00', 'Card', 'Completed', 5000, 5000, '12');
                 INSERT INTO sale_return (id, sale_id, timestamp, refund_method, total_refund_cents)
                     VALUES (3, 7, '2026-03-02 09:00:00', 'Cash', 2000);",
            )
            .execute(&pool)
            .await
            .unwrap();

            let entries = SaleRepository::list(&pool, "2026-03-01", "2026-03-02").await.unwrap();
            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);

            let summary: Vec<_> = entries
                .iter()
                .map(|e| (e.sale_id, e.return_id, e.payment_method, e.total_cents, e.pickup_number.as_deref()))
                .collect();
            assert_eq!(
                summary,
                vec![
                    (7, Some(3), PaymentMethod::Cash, -2000, None),
                    (7, None, PaymentMethod::Card, 5000, Some("12")),
                ]
            );
        });
    }
}
