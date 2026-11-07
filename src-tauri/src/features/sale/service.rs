use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::article::repository::ArticleRepository;
use crate::features::company_profile::repository::CompanyProfileRepository;
use crate::features::customer::repository::CustomerRepository;
use crate::money;

use super::model::{
    ArticleRevenue, DailyRevenue, NewSale, PaymentMethod, PreparedSale, PreparedSaleItem,
    LineDiscountInput, ProductGroupRevenue, SaleDiscountInput, SaleListEntry, SaleWithItems,
};
use super::repository::SaleRepository;

/// Business rules for sales: price lookup at sale time, change calculation,
/// persisting the sale and decrementing stock.
pub struct SaleService;

impl SaleService {
    pub async fn create(pool: &SqlitePool, input: NewSale) -> Result<SaleWithItems, AppError> {
        if !input.payment_method.paid_at_checkout() {
            return Err(AppError::Validation("Zahlung auf Rechnung ist nur für Aufträge möglich".into()));
        }

        let mut prepared_items = Vec::with_capacity(input.items.len());
        for item in &input.items {
            if item.quantity <= 0 {
                return Err(AppError::Validation("Menge muss grösser als 0 sein".into()));
            }
            let article = ArticleRepository::find_by_id(pool, item.article_id)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Artikel {} nicht gefunden", item.article_id)))?;
            // No stock check: an article physically at the counter exists, so a
            // lower system stock is a counting error that the sale corrects
            // (see SaleRepository::create).
            let (unit_price_cents, line_discount_kind, line_discount_value) =
                Self::line_price(article.sale_price_cents, item.discount, &article.name)?;
            prepared_items.push(PreparedSaleItem {
                article_id: article.id,
                quantity: item.quantity,
                list_price_cents: article.total_price_cents,
                unit_price_cents,
                article_discount_percent: article.discount_percent,
                line_discount_kind,
                line_discount_value,
                discount_cents: 0,
                note: None,
            });
        }

        let vat_rate_percent = CompanyProfileRepository::get(pool).await?.vat_rate_percent;
        let mut prepared = Self::prepare(
            prepared_items,
            input.discount,
            input.payment_method,
            input.cash_given_cents,
            vat_rate_percent,
        )?;
        prepared.pickup_number = input.pickup_number;
        prepared.open_sale_id = input.open_sale_id;
        SaleRepository::create(pool, &prepared).await
    }

    /// Applies the sale discount and the payment to priced lines. Shared by
    /// the checkout and customer orders, whose lines keep the prices agreed
    /// when the order was taken. Prices include VAT; `vat_rate_percent` is
    /// the rate in force now, kept with the sale.
    pub fn prepare(
        mut items: Vec<PreparedSaleItem>,
        discount: Option<SaleDiscountInput>,
        payment_method: PaymentMethod,
        cash_given_cents: Option<i64>,
        vat_rate_percent: f64,
    ) -> Result<PreparedSale, AppError> {
        if items.is_empty() {
            return Err(AppError::Validation("Warenkorb ist leer".into()));
        }
        let totals = Self::apply_sale_discount(&mut items, discount)?;

        let (cash_given_cents, change_cents) = match payment_method {
            PaymentMethod::Cash => {
                let given = cash_given_cents
                    .ok_or_else(|| AppError::Validation("Gegebener Betrag fehlt für Barzahlung".into()))?;
                if given < totals.total_cents {
                    return Err(AppError::Validation("Gegebener Betrag reicht nicht aus".into()));
                }
                (Some(given), Some(given - totals.total_cents))
            }
            PaymentMethod::Twint | PaymentMethod::Card | PaymentMethod::Invoice | PaymentMethod::BankTransfer => {
                (None, None)
            }
        };

        Ok(PreparedSale {
            payment_method,
            subtotal_cents: totals.subtotal_cents,
            discount_cents: totals.discount.cents,
            discount_percent: totals.discount.percent,
            discount_kind: totals.discount.kind,
            discount_cumulative: totals.discount.cumulative,
            total_cents: totals.total_cents,
            cash_given_cents,
            change_cents,
            vat_rate_percent,
            vat_cents: money::vat_included(totals.total_cents, vat_rate_percent),
            pickup_number: None,
            open_sale_id: None,
            items,
        })
    }

    /// Validates the sale discount and spreads it over the lines it applies
    /// to, so revenue per article / product group and refunds reflect what
    /// was actually paid.
    pub fn apply_sale_discount(
        items: &mut [PreparedSaleItem],
        discount: Option<SaleDiscountInput>,
    ) -> Result<SaleTotals, AppError> {
        let subtotal_cents: i64 = items.iter().map(|i| i.unit_price_cents * i.quantity).sum();
        let sale_discount = Self::sale_discount(discount, items, subtotal_cents)?;
        for (item, share) in items
            .iter_mut()
            .zip(money::allocate_proportionally(sale_discount.cents, &sale_discount.weights))
        {
            item.discount_cents = share;
        }
        Ok(SaleTotals { subtotal_cents, total_cents: subtotal_cents - sale_discount.cents, discount: sale_discount })
    }

    /// Unit price after an optional line discount, plus how it was given.
    pub fn line_price(
        price_cents: i64,
        discount: Option<LineDiscountInput>,
        article_name: &str,
    ) -> Result<(i64, Option<&'static str>, Option<f64>), AppError> {
        match discount {
            None => Ok((price_cents, None, None)),
            Some(LineDiscountInput::Percent { value }) => {
                if !(value > 0.0 && value <= 100.0) {
                    return Err(AppError::Validation(format!(
                        "Rabatt für \"{article_name}\" muss zwischen 0 und 100 % liegen"
                    )));
                }
                Ok((money::apply_percent_discount(price_cents, value), Some("percent"), Some(value)))
            }
            Some(LineDiscountInput::Amount { value }) => {
                if value <= 0 || value > price_cents {
                    return Err(AppError::Validation(format!(
                        "Nachlass für \"{article_name}\" muss grösser als 0 und höchstens der Preis sein"
                    )));
                }
                Ok((price_cents - value, Some("amount"), Some(value as f64)))
            }
        }
    }

    fn sale_discount(
        discount: Option<SaleDiscountInput>,
        items: &[PreparedSaleItem],
        subtotal_cents: i64,
    ) -> Result<SaleDiscount, AppError> {
        let line_totals: Vec<i64> = items.iter().map(|i| i.unit_price_cents * i.quantity).collect();
        match discount {
            None => Ok(SaleDiscount::none(line_totals)),
            Some(SaleDiscountInput::Percent { value, cumulative }) => {
                if !(value > 0.0 && value <= 100.0) {
                    return Err(AppError::Validation("Rabatt muss zwischen 0 und 100 % liegen".into()));
                }
                // Not cumulative: lines that already got a promotion or line
                // discount are left out.
                let weights: Vec<i64> = items
                    .iter()
                    .zip(&line_totals)
                    .map(|(item, total)| {
                        if cumulative || item.unit_price_cents >= item.list_price_cents {
                            *total
                        } else {
                            0
                        }
                    })
                    .collect();
                let base: i64 = weights.iter().sum();
                let cents = money::round_to_5_rappen(base as f64 * value / 100.0).min(base);
                Ok(SaleDiscount {
                    cents,
                    weights,
                    percent: Some(value),
                    kind: Some("percent"),
                    cumulative: Some(cumulative),
                })
            }
            Some(SaleDiscountInput::Total { value }) => {
                if value < 0 || value > subtotal_cents {
                    return Err(AppError::Validation(
                        "Der neue Endbetrag muss zwischen 0 und dem Einkaufswert liegen".into(),
                    ));
                }
                Ok(SaleDiscount {
                    cents: subtotal_cents - value,
                    weights: line_totals,
                    percent: None,
                    kind: Some("total"),
                    cumulative: None,
                })
            }
        }
    }

    pub async fn list(pool: &SqlitePool, from: &str, to: &str) -> Result<Vec<SaleListEntry>, AppError> {
        SaleRepository::list(pool, from, to).await
    }

    pub async fn get(pool: &SqlitePool, id: i64) -> Result<SaleWithItems, AppError> {
        SaleRepository::find_with_items(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Verkauf {id} nicht gefunden")))
    }

    /// Assigns a customer to a sale afterwards, or removes them (None). The
    /// sale of a customer order keeps the order's customer.
    pub async fn set_customer(pool: &SqlitePool, id: i64, customer_id: Option<i64>) -> Result<SaleWithItems, AppError> {
        let sale = Self::get(pool, id).await?;
        if sale.sale.customer_order_id.is_some() {
            return Err(AppError::Validation("Dieser Verkauf hat den Kunden seines Auftrags".into()));
        }
        if let Some(customer_id) = customer_id {
            if CustomerRepository::find_by_id(pool, customer_id).await?.is_none() {
                return Err(AppError::Validation("Kunde existiert nicht".into()));
            }
        }
        SaleRepository::set_customer(pool, id, customer_id).await?;
        Self::get(pool, id).await
    }

    pub async fn revenue_by_day(pool: &SqlitePool, from: &str, to: &str) -> Result<Vec<DailyRevenue>, AppError> {
        SaleRepository::revenue_by_day(pool, from, to).await
    }

    pub async fn revenue_by_product_group(
        pool: &SqlitePool,
        from: &str,
        to: &str,
    ) -> Result<Vec<ProductGroupRevenue>, AppError> {
        SaleRepository::revenue_by_product_group(pool, from, to).await
    }

    pub async fn revenue_by_article(
        pool: &SqlitePool,
        from: &str,
        to: &str,
    ) -> Result<Vec<ArticleRevenue>, AppError> {
        SaleRepository::revenue_by_article(pool, from, to).await
    }
}

/// Sums of priced lines after the sale discount.
pub struct SaleTotals {
    pub subtotal_cents: i64,
    pub total_cents: i64,
    pub discount: SaleDiscount,
}

/// The sale discount and the per-line weights it is spread by (0 for lines
/// it doesn't apply to).
pub struct SaleDiscount {
    pub cents: i64,
    weights: Vec<i64>,
    pub percent: Option<f64>,
    pub kind: Option<&'static str>,
    pub cumulative: Option<bool>,
}

impl SaleDiscount {
    fn none(weights: Vec<i64>) -> Self {
        Self { cents: 0, weights, percent: None, kind: None, cumulative: None }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(list: i64, unit: i64, quantity: i64) -> PreparedSaleItem {
        PreparedSaleItem {
            article_id: 0,
            quantity,
            list_price_cents: list,
            unit_price_cents: unit,
            article_discount_percent: 0.0,
            line_discount_kind: None,
            line_discount_value: None,
            discount_cents: 0,
            note: None,
        }
    }

    // Shirt 25.00 with a 5 % promotion (23.75) + Tasse 10.00.
    fn cart() -> Vec<PreparedSaleItem> {
        vec![line(2500, 2375, 1), line(1000, 1000, 1)]
    }

    #[test]
    fn percent_not_cumulative_skips_discounted_lines() {
        let items = cart();
        let d = SaleService::sale_discount(
            Some(SaleDiscountInput::Percent { value: 10.0, cumulative: false }),
            &items,
            3375,
        )
        .unwrap();
        assert_eq!(d.cents, 100); // only the Tasse
        assert_eq!(d.weights, vec![0, 1000]);
    }

    #[test]
    fn percent_cumulative_applies_to_all_lines() {
        let items = cart();
        let d = SaleService::sale_discount(
            Some(SaleDiscountInput::Percent { value: 10.0, cumulative: true }),
            &items,
            3375,
        )
        .unwrap();
        assert_eq!(d.cents, 340); // 10 % of 33.75 = 3.375, rounded to 5 Rappen
    }

    #[test]
    fn new_total_books_the_difference_as_discount() {
        let items = cart();
        let d = SaleService::sale_discount(Some(SaleDiscountInput::Total { value: 3000 }), &items, 3375).unwrap();
        assert_eq!(d.cents, 375);
        assert!(SaleService::sale_discount(Some(SaleDiscountInput::Total { value: 4000 }), &items, 3375).is_err());
    }

    #[test]
    fn customer_can_be_assigned_to_a_sale_without_order() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();
            sqlx::raw_sql(
                "INSERT INTO customer (id, first_name, last_name, company) VALUES (1, 'Anna', 'Muster', 'Muster AG');
                 INSERT INTO sale (id, timestamp, payment_method, status, total_cents)
                     VALUES (1, '2026-03-01 10:00:00', 'Cash', 'Completed', 5000),
                            (2, '2026-03-01 11:00:00', 'Cash', 'Completed', 5000);
                 INSERT INTO sale_return (sale_id, timestamp, refund_method, total_refund_cents)
                     VALUES (1, '2026-03-02 09:00:00', 'Cash', 2000);
                 INSERT INTO customer_order (customer_id, payment_method, sale_id) VALUES (1, 'Cash', 2);",
            )
            .execute(&pool)
            .await
            .unwrap();

            let assigned = SaleService::set_customer(&pool, 1, Some(1)).await.unwrap();
            assert_eq!(assigned.sale.customer_name.as_deref(), Some("Anna Muster"));
            assert_eq!(assigned.sale.customer_company.as_deref(), Some("Muster AG"));
            // The return in the list shows the customer of its sale too.
            let entries = SaleService::list(&pool, "2026-03-01", "2026-03-02").await.unwrap();
            assert!(entries.iter().all(|e| e.customer_name.as_deref() == Some("Anna Muster")));

            assert!(SaleService::set_customer(&pool, 1, Some(99)).await.is_err());
            assert!(SaleService::set_customer(&pool, 1, None).await.unwrap().sale.customer_name.is_none());
            // The sale of an order keeps the order's customer.
            assert!(SaleService::set_customer(&pool, 2, None).await.is_err());

            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);
        });
    }

    #[test]
    fn line_discounts() {
        let (price, kind, _) =
            SaleService::line_price(2000, Some(LineDiscountInput::Percent { value: 10.0 }), "x").unwrap();
        assert_eq!((price, kind), (1800, Some("percent")));
        let (price, kind, _) = SaleService::line_price(2000, Some(LineDiscountInput::Amount { value: 500 }), "x").unwrap();
        assert_eq!((price, kind), (1500, Some("amount")));
        assert!(SaleService::line_price(2000, Some(LineDiscountInput::Amount { value: 2500 }), "x").is_err());
        assert!(SaleService::line_price(2000, Some(LineDiscountInput::Amount { value: 0 }), "x").is_err());
    }
}
