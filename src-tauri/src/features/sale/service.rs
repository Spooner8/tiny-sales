use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::article::repository::ArticleRepository;
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
        if input.items.is_empty() {
            return Err(AppError::Validation("Warenkorb ist leer".into()));
        }

        let mut prepared_items = Vec::with_capacity(input.items.len());
        let mut subtotal_cents: i64 = 0;

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
            subtotal_cents += unit_price_cents * item.quantity;
            prepared_items.push(PreparedSaleItem {
                article_id: article.id,
                quantity: item.quantity,
                list_price_cents: article.total_price_cents,
                unit_price_cents,
                article_discount_percent: article.discount_percent,
                line_discount_kind,
                line_discount_value,
                discount_cents: 0,
            });
        }

        let sale_discount = Self::sale_discount(input.discount, &prepared_items, subtotal_cents)?;
        // Spread the sale discount over the lines it applies to, so revenue per
        // article / product group and refunds reflect what was actually paid.
        for (item, share) in prepared_items
            .iter_mut()
            .zip(money::allocate_proportionally(sale_discount.cents, &sale_discount.weights))
        {
            item.discount_cents = share;
        }
        let discount_cents = sale_discount.cents;
        let total_cents = subtotal_cents - discount_cents;

        let (cash_given_cents, change_cents) = match input.payment_method {
            PaymentMethod::Cash => {
                let given = input
                    .cash_given_cents
                    .ok_or_else(|| AppError::Validation("Gegebener Betrag fehlt für Barzahlung".into()))?;
                if given < total_cents {
                    return Err(AppError::Validation("Gegebener Betrag reicht nicht aus".into()));
                }
                (Some(given), Some(given - total_cents))
            }
            PaymentMethod::Twint | PaymentMethod::Card => (None, None),
        };

        let prepared = PreparedSale {
            payment_method: input.payment_method,
            subtotal_cents,
            discount_cents,
            discount_percent: sale_discount.percent,
            discount_kind: sale_discount.kind,
            discount_cumulative: sale_discount.cumulative,
            total_cents,
            cash_given_cents,
            change_cents,
            pickup_number: input.pickup_number,
            open_sale_id: input.open_sale_id,
            items: prepared_items,
        };

        SaleRepository::create(pool, &prepared).await
    }

    /// Unit price after an optional line discount, plus how it was given.
    fn line_price(
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
            Some(LineDiscountInput::Price { value }) => {
                if value < 0 || value > price_cents {
                    return Err(AppError::Validation(format!(
                        "Neuer Preis für \"{article_name}\" muss zwischen 0 und dem aktuellen Preis liegen"
                    )));
                }
                Ok((value, Some("price"), Some(value as f64)))
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

/// The sale discount and the per-line weights it is spread by (0 for lines
/// it doesn't apply to).
struct SaleDiscount {
    cents: i64,
    weights: Vec<i64>,
    percent: Option<f64>,
    kind: Option<&'static str>,
    cumulative: Option<bool>,
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
    fn line_discounts() {
        let (price, kind, _) =
            SaleService::line_price(2000, Some(LineDiscountInput::Percent { value: 10.0 }), "x").unwrap();
        assert_eq!((price, kind), (1800, Some("percent")));
        let (price, kind, _) = SaleService::line_price(2000, Some(LineDiscountInput::Price { value: 1500 }), "x").unwrap();
        assert_eq!((price, kind), (1500, Some("price")));
        assert!(SaleService::line_price(2000, Some(LineDiscountInput::Price { value: 2500 }), "x").is_err());
    }
}
