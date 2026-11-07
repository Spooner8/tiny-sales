use std::collections::HashMap;

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppError;
use crate::features::sale::model::PaymentMethod;

use super::model::{CustomerOrderItemRecord, CustomerOrderRecord, PreparedOrderItem};

const SELECT_ORDER: &str = "
    SELECT customer_order.id as id, customer_order.customer_id as customer_id,
           customer.first_name || ' ' || customer.last_name as customer_name, customer.company as customer_company,
           customer_order.status as status, customer_order.payment_method as payment_method,
           customer_order.discount_kind as discount_kind, customer_order.discount_value as discount_value,
           customer_order.discount_cumulative as discount_cumulative, customer_order.sale_id as sale_id,
           invoice.id as invoice_id, invoice.paid_on as invoice_paid_on, sale.total_cents as sale_total_cents,
           (SELECT COALESCE(SUM(total_refund_cents), 0) FROM sale_return
            WHERE sale_return.sale_id = customer_order.sale_id) as refunded_cents,
           customer_order.created_at as created_at, customer_order.updated_at as updated_at
    FROM customer_order
    JOIN customer ON customer.id = customer_order.customer_id
    LEFT JOIN sale ON sale.id = customer_order.sale_id
    LEFT JOIN invoice ON invoice.sale_id = customer_order.sale_id";

const SELECT_ITEMS: &str = "
    SELECT customer_order_item.id as id, customer_order_item.customer_order_id as customer_order_id,
           customer_order_item.article_id as article_id, article.code as article_code, article.name as article_name,
           article.internal_number as article_internal_number, customer_order_item.quantity as quantity,
           customer_order_item.list_price_cents as list_price_cents,
           customer_order_item.sale_price_cents as sale_price_cents,
           customer_order_item.article_discount_percent as article_discount_percent,
           customer_order_item.line_discount_kind as line_discount_kind,
           customer_order_item.line_discount_value as line_discount_value, customer_order_item.note as note
    FROM customer_order_item
    JOIN article ON article.id = customer_order_item.article_id";

/// The order discount as stored: kind, value and the cumulative flag.
pub struct StoredOrderDiscount {
    pub kind: Option<&'static str>,
    pub value: Option<f64>,
    pub cumulative: bool,
}

pub struct CustomerOrderRepository;

impl CustomerOrderRepository {
    /// All orders with their lines, newest first.
    pub async fn list(
        pool: &SqlitePool,
    ) -> Result<Vec<(CustomerOrderRecord, Vec<CustomerOrderItemRecord>)>, AppError> {
        let orders = sqlx::query_as::<_, CustomerOrderRecord>(&format!("{SELECT_ORDER} ORDER BY customer_order.id DESC"))
            .fetch_all(pool)
            .await?;
        let items = sqlx::query_as::<_, CustomerOrderItemRecord>(&format!(
            "{SELECT_ITEMS} ORDER BY customer_order_item.customer_order_id, customer_order_item.position"
        ))
        .fetch_all(pool)
        .await?;

        let mut items_by_order: HashMap<i64, Vec<CustomerOrderItemRecord>> = HashMap::new();
        for item in items {
            items_by_order.entry(item.customer_order_id).or_default().push(item);
        }
        Ok(orders
            .into_iter()
            .map(|order| {
                let items = items_by_order.remove(&order.id).unwrap_or_default();
                (order, items)
            })
            .collect())
    }

    pub async fn find(
        pool: &SqlitePool,
        id: i64,
    ) -> Result<Option<(CustomerOrderRecord, Vec<CustomerOrderItemRecord>)>, AppError> {
        let Some(order) = sqlx::query_as::<_, CustomerOrderRecord>(&format!("{SELECT_ORDER} WHERE customer_order.id = ?"))
            .bind(id)
            .fetch_optional(pool)
            .await?
        else {
            return Ok(None);
        };
        let items = sqlx::query_as::<_, CustomerOrderItemRecord>(&format!(
            "{SELECT_ITEMS} WHERE customer_order_item.customer_order_id = ? ORDER BY customer_order_item.position"
        ))
        .bind(id)
        .fetch_all(pool)
        .await?;
        Ok(Some((order, items)))
    }

    /// Inserts the order (without `id`) or updates it, and replaces its lines.
    /// Lines that were saved before keep their id. Returns the order id.
    pub async fn save(
        pool: &SqlitePool,
        id: Option<i64>,
        customer_id: i64,
        status: &str,
        payment_method: PaymentMethod,
        discount: &StoredOrderDiscount,
        items: &[PreparedOrderItem],
    ) -> Result<i64, AppError> {
        let mut tx = pool.begin().await?;

        let order_id = match id {
            Some(id) => {
                sqlx::query(
                    "UPDATE customer_order
                     SET customer_id = ?, status = ?, payment_method = ?, discount_kind = ?, discount_value = ?,
                         discount_cumulative = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?",
                )
                .bind(customer_id)
                .bind(status)
                .bind(payment_method.as_str())
                .bind(discount.kind)
                .bind(discount.value)
                .bind(discount.cumulative)
                .bind(id)
                .execute(&mut *tx)
                .await?;
                sqlx::query("DELETE FROM customer_order_item WHERE customer_order_id = ?")
                    .bind(id)
                    .execute(&mut *tx)
                    .await?;
                id
            }
            None => sqlx::query(
                "INSERT INTO customer_order (customer_id, status, payment_method, discount_kind, discount_value, discount_cumulative)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(customer_id)
            .bind(status)
            .bind(payment_method.as_str())
            .bind(discount.kind)
            .bind(discount.value)
            .bind(discount.cumulative)
            .execute(&mut *tx)
            .await?
            .last_insert_rowid(),
        };

        for (position, item) in items.iter().enumerate() {
            sqlx::query(
                "INSERT INTO customer_order_item (id, customer_order_id, position, article_id, quantity, list_price_cents,
                                                  sale_price_cents, article_discount_percent, line_discount_kind,
                                                  line_discount_value, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(item.id)
            .bind(order_id)
            .bind(position as i64)
            .bind(item.article_id)
            .bind(item.quantity)
            .bind(item.list_price_cents)
            .bind(item.sale_price_cents)
            .bind(item.article_discount_percent)
            .bind(item.line_discount_kind)
            .bind(item.line_discount_value)
            .bind(&item.note)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(order_id)
    }

    pub async fn set_status(pool: &SqlitePool, id: i64, status: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE customer_order SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        let mut tx = pool.begin().await?;
        sqlx::query("DELETE FROM customer_order_item WHERE customer_order_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM customer_order WHERE id = ? AND sale_id IS NULL")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Links the order to the sale that completed it. Fails if another
    /// computer completed it in the meantime, which rolls the sale back.
    pub async fn mark_completed_in(
        tx: &mut Transaction<'_, Sqlite>,
        id: i64,
        sale_id: i64,
        payment_method: PaymentMethod,
    ) -> Result<(), AppError> {
        let updated = sqlx::query(
            "UPDATE customer_order SET sale_id = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND sale_id IS NULL",
        )
        .bind(sale_id)
        .bind(payment_method.as_str())
        .bind(id)
        .execute(&mut **tx)
        .await?
        .rows_affected();
        if updated == 0 {
            return Err(AppError::Validation(format!("Auftrag {id} ist bereits abgerechnet")));
        }
        Ok(())
    }
}
