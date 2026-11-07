use std::collections::{HashMap, HashSet};
use std::str::FromStr;

use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::article::repository::ArticleRepository;
use crate::features::company_profile::repository::CompanyProfileRepository;
use crate::features::customer::repository::CustomerRepository;
use crate::features::invoice::repository::InvoiceRepository;
use crate::features::invoice::service::InvoiceService;
use crate::features::sale::model::{
    LineDiscountInput, PaymentMethod, PreparedSaleItem, SaleDiscountInput,
};
use crate::features::sale::repository::SaleRepository;
use crate::features::sale::service::SaleService;

use super::model::{
    CompleteCustomerOrder, CompletedCustomerOrder, CustomerOrder, CustomerOrderItem, CustomerOrderItemRecord,
    CustomerOrderRecord, PreparedOrderItem, SaveCustomerOrder, ORDER_STATUSES,
};
use super::repository::{CustomerOrderRepository, StoredOrderDiscount};

/// Business rules for customer orders: lines keep the prices from when they
/// were added, discounts are validated like at the checkout, and completing
/// books a sale (and for payment by invoice, the invoice) exactly once.
pub struct CustomerOrderService;

impl CustomerOrderService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<CustomerOrder>, AppError> {
        CustomerOrderRepository::list(pool)
            .await?
            .into_iter()
            .map(|(order, items)| Self::to_domain(order, items))
            .collect()
    }

    pub async fn get(pool: &SqlitePool, id: i64) -> Result<CustomerOrder, AppError> {
        let (order, items) = CustomerOrderRepository::find(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Auftrag {id} nicht gefunden")))?;
        Self::to_domain(order, items)
    }

    pub async fn save(pool: &SqlitePool, input: SaveCustomerOrder) -> Result<CustomerOrder, AppError> {
        Self::validate_status(&input.status)?;
        Self::validate_payment_method(input.payment_method)?;
        if CustomerRepository::find_by_id(pool, input.customer_id).await?.is_none() {
            return Err(AppError::Validation("Kunde existiert nicht".into()));
        }

        let mut existing: HashMap<i64, CustomerOrderItemRecord> = HashMap::new();
        if let Some(id) = input.id {
            let (order, items) = CustomerOrderRepository::find(pool, id)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Auftrag {id} nicht gefunden")))?;
            if order.sale_id.is_some() {
                return Err(AppError::Validation("Abgerechnete Aufträge können nicht mehr geändert werden".into()));
            }
            existing = items.into_iter().map(|item| (item.id, item)).collect();
        }

        let mut kept_ids = HashSet::new();
        let mut order_items = Vec::with_capacity(input.items.len());
        let mut priced_items = Vec::with_capacity(input.items.len());
        for item in input.items {
            if item.quantity <= 0 {
                return Err(AppError::Validation("Menge muss grösser als 0 sein".into()));
            }
            // A line saved before keeps the prices from when it was added.
            let saved = item
                .id
                .and_then(|id| existing.get(&id))
                .filter(|saved| saved.article_id == item.article_id && kept_ids.insert(saved.id));
            let (id, list_price_cents, sale_price_cents, article_discount_percent, article_name) = match saved {
                Some(saved) => (
                    Some(saved.id),
                    saved.list_price_cents,
                    saved.sale_price_cents,
                    saved.article_discount_percent,
                    saved.article_name.clone(),
                ),
                None => {
                    let article = ArticleRepository::find_by_id(pool, item.article_id)
                        .await?
                        .ok_or_else(|| AppError::NotFound(format!("Artikel {} nicht gefunden", item.article_id)))?;
                    (None, article.total_price_cents, article.sale_price_cents, article.discount_percent, article.name)
                }
            };
            let (unit_price_cents, line_discount_kind, line_discount_value) =
                SaleService::line_price(sale_price_cents, item.discount, &article_name)?;
            priced_items.push(PreparedSaleItem {
                article_id: item.article_id,
                quantity: item.quantity,
                list_price_cents,
                unit_price_cents,
                article_discount_percent,
                line_discount_kind,
                line_discount_value,
                discount_cents: 0,
                note: None,
            });
            order_items.push(PreparedOrderItem {
                id,
                article_id: item.article_id,
                quantity: item.quantity,
                list_price_cents,
                sale_price_cents,
                article_discount_percent,
                line_discount_kind,
                line_discount_value,
                note: item.note.map(|n| n.trim().to_string()).filter(|n| !n.is_empty()),
            });
        }
        // Checked now, so the order can be completed later as it was saved.
        SaleService::apply_sale_discount(&mut priced_items, input.discount)?;

        let id = CustomerOrderRepository::save(
            pool,
            input.id,
            input.customer_id,
            &input.status,
            input.payment_method,
            &stored_discount(input.discount),
            &order_items,
        )
        .await?;
        Self::get(pool, id).await
    }

    /// The status can still change after completion, e.g. to "delivered".
    pub async fn set_status(pool: &SqlitePool, id: i64, status: String) -> Result<CustomerOrder, AppError> {
        Self::validate_status(&status)?;
        Self::get(pool, id).await?;
        CustomerOrderRepository::set_status(pool, id, &status).await?;
        Self::get(pool, id).await
    }

    pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        let order = Self::get(pool, id).await?;
        if order.sale_id.is_some() {
            return Err(AppError::Validation("Abgerechnete Aufträge können nicht gelöscht werden".into()));
        }
        CustomerOrderRepository::delete(pool, id).await
    }

    pub async fn complete(pool: &SqlitePool, input: CompleteCustomerOrder) -> Result<CompletedCustomerOrder, AppError> {
        Self::validate_payment_method(input.payment_method)?;
        let (order, items) = CustomerOrderRepository::find(pool, input.order_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Auftrag {} nicht gefunden", input.order_id)))?;
        if order.sale_id.is_some() {
            return Err(AppError::Validation(format!("Auftrag {} ist bereits abgerechnet", order.id)));
        }
        if items.is_empty() {
            return Err(AppError::Validation("Der Auftrag enthält keine Artikel".into()));
        }
        // Checked before anything is booked: an invoice without a payment
        // part couldn't be sent.
        let payment_days = match input.payment_method {
            PaymentMethod::Invoice => Some(InvoiceService::check_issuable(pool).await?),
            _ => None,
        };

        let mut priced_items = Vec::with_capacity(items.len());
        for item in items {
            let (unit_price_cents, line_discount_kind, line_discount_value) =
                SaleService::line_price(item.sale_price_cents, line_discount(&item), &item.article_name)?;
            priced_items.push(PreparedSaleItem {
                article_id: item.article_id,
                quantity: item.quantity,
                list_price_cents: item.list_price_cents,
                unit_price_cents,
                article_discount_percent: item.article_discount_percent,
                line_discount_kind,
                line_discount_value,
                discount_cents: 0,
                note: item.note,
            });
        }
        // The rate in force when the order is completed, i.e. delivered.
        let vat_rate_percent = CompanyProfileRepository::get(pool).await?.vat_rate_percent;
        let prepared = SaleService::prepare(
            priced_items,
            input.discount,
            input.payment_method,
            input.cash_given_cents,
            vat_rate_percent,
        )?;

        // Sale, completion and invoice in one transaction: an order is never
        // booked twice, nor without its invoice.
        let mut tx = pool.begin().await?;
        let sale_id = SaleRepository::create_in(&mut tx, &prepared).await?;
        CustomerOrderRepository::mark_completed_in(&mut tx, order.id, sale_id, input.payment_method).await?;
        let invoice_id = match payment_days {
            Some(days) => Some(InvoiceRepository::create_in(&mut tx, sale_id, days).await?),
            None => None,
        };
        tx.commit().await?;

        let sale = SaleRepository::find_with_items(pool, sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Verkauf {sale_id} nach dem Anlegen nicht gefunden")))?;
        Ok(CompletedCustomerOrder { sale, invoice_id })
    }

    /// Paid at the checkout or by invoice; a transfer is only for refunds.
    fn validate_payment_method(payment_method: PaymentMethod) -> Result<(), AppError> {
        if !payment_method.paid_at_checkout() && payment_method != PaymentMethod::Invoice {
            return Err(AppError::Validation("Überweisung ist nur für Rückerstattungen möglich".into()));
        }
        Ok(())
    }

    fn validate_status(status: &str) -> Result<(), AppError> {
        if !ORDER_STATUSES.contains(&status) {
            return Err(AppError::Validation(format!("Unbekannter Auftragsstatus: {status}")));
        }
        Ok(())
    }

    fn to_domain(order: CustomerOrderRecord, items: Vec<CustomerOrderItemRecord>) -> Result<CustomerOrder, AppError> {
        let discount = sale_discount(&order);
        let mut priced_items = Vec::with_capacity(items.len());
        let mut order_items = Vec::with_capacity(items.len());
        for item in items {
            let discount = line_discount(&item);
            // Stored discounts were validated when saving.
            let unit_price_cents = SaleService::line_price(item.sale_price_cents, discount, &item.article_name)
                .map(|(price, _, _)| price)
                .unwrap_or(item.sale_price_cents);
            priced_items.push(PreparedSaleItem {
                article_id: item.article_id,
                quantity: item.quantity,
                list_price_cents: item.list_price_cents,
                unit_price_cents,
                article_discount_percent: item.article_discount_percent,
                line_discount_kind: None,
                line_discount_value: None,
                discount_cents: 0,
                note: None,
            });
            order_items.push(CustomerOrderItem {
                id: item.id,
                article_id: item.article_id,
                article_code: item.article_code,
                article_name: item.article_name,
                article_internal_number: item.article_internal_number,
                quantity: item.quantity,
                list_price_cents: item.list_price_cents,
                sale_price_cents: item.sale_price_cents,
                article_discount_percent: item.article_discount_percent,
                discount,
                unit_price_cents,
                note: item.note,
            });
        }
        let subtotal_cents: i64 = priced_items.iter().map(|i| i.unit_price_cents * i.quantity).sum();
        let discount_cents = SaleService::apply_sale_discount(&mut priced_items, discount)
            .map(|totals| totals.discount.cents)
            .unwrap_or(0);

        let done = order_done(&order);
        Ok(CustomerOrder {
            id: order.id,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            customer_company: order.customer_company,
            status: order.status,
            payment_method: PaymentMethod::from_str(&order.payment_method)?,
            discount,
            sale_id: order.sale_id,
            invoice_id: order.invoice_id,
            invoice_paid_on: order.invoice_paid_on,
            done,
            created_at: order.created_at,
            updated_at: order.updated_at,
            items: order_items,
            subtotal_cents,
            discount_cents,
            total_cents: subtotal_cents - discount_cents,
        })
    }
}

/// Billing doesn't finish an order: it may still have to be produced and
/// delivered, and an invoice paid. A fully returned order is over either way.
fn order_done(order: &CustomerOrderRecord) -> bool {
    let Some(total_cents) = order.sale_total_cents else {
        return false;
    };
    let returned = order.refunded_cents > 0 && order.refunded_cents >= total_cents;
    let paid = order.invoice_id.is_none() || order.invoice_paid_on.is_some();
    returned || (order.status == "delivered" && paid)
}

fn line_discount(item: &CustomerOrderItemRecord) -> Option<LineDiscountInput> {
    match (item.line_discount_kind.as_deref(), item.line_discount_value) {
        (Some("percent"), Some(value)) => Some(LineDiscountInput::Percent { value }),
        (Some("amount"), Some(value)) => Some(LineDiscountInput::Amount { value: value.round() as i64 }),
        // Lines saved while a line discount was a new unit price.
        (Some("price"), Some(value)) => {
            let amount = item.sale_price_cents - value.round() as i64;
            (amount > 0).then_some(LineDiscountInput::Amount { value: amount })
        }
        _ => None,
    }
}

fn sale_discount(order: &CustomerOrderRecord) -> Option<SaleDiscountInput> {
    match (order.discount_kind.as_deref(), order.discount_value) {
        (Some("percent"), Some(value)) => {
            Some(SaleDiscountInput::Percent { value, cumulative: order.discount_cumulative })
        }
        (Some("total"), Some(value)) => Some(SaleDiscountInput::Total { value: value.round() as i64 }),
        _ => None,
    }
}

fn stored_discount(discount: Option<SaleDiscountInput>) -> StoredOrderDiscount {
    match discount {
        None => StoredOrderDiscount { kind: None, value: None, cumulative: false },
        Some(SaleDiscountInput::Percent { value, cumulative }) => {
            StoredOrderDiscount { kind: Some("percent"), value: Some(value), cumulative }
        }
        Some(SaleDiscountInput::Total { value }) => {
            StoredOrderDiscount { kind: Some("total"), value: Some(value as f64), cumulative: false }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::customer_order::model::SaveCustomerOrderItem;

    const SEED: &str = "
        INSERT INTO product_group (id, name) VALUES (1, 'Shirts');
        INSERT INTO product_subgroup (id, name, product_group_id) VALUES (1, 'Kinder', 1);
        INSERT INTO article (id, code, name, product_group_id, product_subgroup_id, price_cents, stock)
            VALUES (1, 'A1', 'Shirt', 1, 1, 2500, 5);
        INSERT INTO customer (id, first_name, last_name) VALUES (1, 'Anna', 'Muster');
    ";

    fn with_pool(test: impl AsyncFnOnce(&SqlitePool)) {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();
            sqlx::raw_sql(SEED).execute(&pool).await.unwrap();
            test(&pool).await;
            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);
        });
    }

    fn order(id: Option<i64>, payment_method: PaymentMethod, items: Vec<SaveCustomerOrderItem>) -> SaveCustomerOrder {
        SaveCustomerOrder { id, customer_id: 1, status: "open".into(), payment_method, discount: None, items }
    }

    fn line(id: Option<i64>, quantity: i64, discount: Option<LineDiscountInput>, note: Option<&str>) -> SaveCustomerOrderItem {
        SaveCustomerOrderItem { id, article_id: 1, quantity, discount, note: note.map(Into::into) }
    }

    fn complete(order_id: i64, payment_method: PaymentMethod) -> CompleteCustomerOrder {
        CompleteCustomerOrder { order_id, payment_method, cash_given_cents: None, discount: None }
    }

    async fn sale_count(pool: &SqlitePool) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM sale").fetch_one(pool).await.unwrap()
    }

    #[test]
    fn order_is_invoiced_once_at_the_agreed_prices() {
        with_pool(async |pool| {
            sqlx::query(
                "UPDATE company_profile SET name = 'Testladen', street = 'Bahnhofstrasse 1', postal_city = '8000 Zürich',
                        iban = 'CH44 3199 9123 0008 8901 2', vat_rate_percent = 8.1",
            )
            .execute(pool)
            .await
            .unwrap();
            let items = vec![
                line(None, 1, None, Some(" Name: Lena ")),
                line(None, 2, Some(LineDiscountInput::Percent { value: 10.0 }), None),
            ];
            let saved = CustomerOrderService::save(pool, order(None, PaymentMethod::Invoice, items)).await.unwrap();
            assert_eq!(saved.total_cents, 2500 + 2 * 2250);

            // A price change after the order was taken doesn't apply to its lines.
            sqlx::query("UPDATE article SET price_cents = 3000").execute(pool).await.unwrap();
            let items = saved
                .items
                .iter()
                .map(|item| line(Some(item.id), item.quantity, item.discount, item.note.as_deref()))
                .collect();
            let saved = CustomerOrderService::save(pool, order(Some(saved.id), PaymentMethod::Invoice, items))
                .await
                .unwrap();
            assert_eq!(saved.total_cents, 7000);

            let completed = CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Invoice))
                .await
                .unwrap();
            assert_eq!(completed.sale.sale.total_cents, 7000);
            // 70.00 incl. 8.1 % VAT = 5.245..., rounded to 5.25
            assert_eq!(completed.sale.sale.vat_rate_percent, Some(8.1));
            assert_eq!(completed.sale.sale.vat_cents, Some(525));
            assert_eq!(completed.sale.sale.customer_name.as_deref(), Some("Anna Muster"));
            assert_eq!(completed.sale.items[0].note.as_deref(), Some("Name: Lena"));
            let invoice_id = completed.invoice_id.expect("no invoice created");
            assert!(CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Invoice)).await.is_err());
            assert_eq!(sale_count(pool).await, 1);

            let invoice = InvoiceService::get(pool, invoice_id).await.unwrap();
            let payment = invoice.payment.expect("no payment part");
            assert!(payment.qr_payload.contains("\n70.00\nCHF\n"));
            assert!(!invoice.invoice.has_pdf);
        });
    }

    #[test]
    fn billed_order_stays_open_until_delivered_and_paid() {
        with_pool(async |pool| {
            let saved = CustomerOrderService::save(pool, order(None, PaymentMethod::Card, vec![line(None, 1, None, None)]))
                .await
                .unwrap();
            CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Card)).await.unwrap();
            assert!(!CustomerOrderService::get(pool, saved.id).await.unwrap().done);
            let delivered = CustomerOrderService::set_status(pool, saved.id, "delivered".into()).await.unwrap();
            assert!(delivered.done);

            // By invoice, it also has to be paid.
            sqlx::query(
                "UPDATE company_profile SET name = 'Testladen', street = 'Bahnhofstrasse 1', postal_city = '8000 Zürich',
                        iban = 'CH44 3199 9123 0008 8901 2'",
            )
            .execute(pool)
            .await
            .unwrap();
            let saved = CustomerOrderService::save(pool, order(None, PaymentMethod::Invoice, vec![line(None, 1, None, None)]))
                .await
                .unwrap();
            let invoice_id = CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Invoice))
                .await
                .unwrap()
                .invoice_id
                .unwrap();
            assert!(!CustomerOrderService::set_status(pool, saved.id, "delivered".into()).await.unwrap().done);
            InvoiceService::set_paid_on(pool, invoice_id, Some("2026-11-07".into())).await.unwrap();
            let paid = CustomerOrderService::get(pool, saved.id).await.unwrap();
            assert!(paid.done);
            assert_eq!(paid.invoice_paid_on.as_deref(), Some("2026-11-07"));

            // Returned completely, nothing is left to deliver or to pay.
            let saved = CustomerOrderService::save(pool, order(None, PaymentMethod::Card, vec![line(None, 1, None, None)]))
                .await
                .unwrap();
            let sale = CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Card)).await.unwrap().sale;
            sqlx::query("INSERT INTO sale_return (sale_id, refund_method, total_refund_cents) VALUES (?, 'Card', ?)")
                .bind(sale.sale.id)
                .bind(sale.sale.total_cents)
                .execute(pool)
                .await
                .unwrap();
            assert!(CustomerOrderService::get(pool, saved.id).await.unwrap().done);
        });
    }

    #[test]
    fn invoice_needs_a_complete_company_profile() {
        with_pool(async |pool| {
            let saved = CustomerOrderService::save(pool, order(None, PaymentMethod::Invoice, vec![line(None, 1, None, None)]))
                .await
                .unwrap();
            let err = CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Invoice))
                .await
                .unwrap_err();
            assert!(err.to_string().contains("Firmenprofil"), "{err}");
            assert_eq!(sale_count(pool).await, 0);

            // Paid at the checkout instead, it needs no invoice details.
            CustomerOrderService::complete(pool, complete(saved.id, PaymentMethod::Card)).await.unwrap();
            assert_eq!(sale_count(pool).await, 1);
        });
    }
}
