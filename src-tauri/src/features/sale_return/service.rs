use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::sale::repository::SaleRepository;
use crate::money;

use super::model::{NewSaleReturn, PreparedSaleReturn, PreparedSaleReturnItem, SaleReturnWithItems};
use super::repository::SaleReturnRepository;

/// Business rules for returns: a return always references an existing
/// sale, can only return up to the (original - already returned)
/// quantity per article, and refunds what was actually paid for the
/// returned units (after article promotions and the sale discount).
pub struct SaleReturnService;

impl SaleReturnService {
    pub async fn create(pool: &SqlitePool, input: NewSaleReturn) -> Result<SaleReturnWithItems, AppError> {
        if input.items.is_empty() {
            return Err(AppError::Validation("Keine Positionen für die Retoure ausgewählt".into()));
        }

        let sale = SaleRepository::find_with_items(pool, input.sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Verkauf {} nicht gefunden", input.sale_id)))?;

        let already_returned = SaleReturnRepository::returned_quantities(pool, input.sale_id).await?;

        let mut prepared_items = Vec::with_capacity(input.items.len());
        let mut total_refund_cents: i64 = 0;

        for item in &input.items {
            if item.quantity <= 0 {
                return Err(AppError::Validation("Menge muss grösser als 0 sein".into()));
            }
            let original = sale
                .items
                .iter()
                .find(|i| i.article_id == item.article_id)
                .ok_or_else(|| {
                    AppError::Validation(format!(
                        "Artikel {} war nicht Teil dieses Verkaufs",
                        item.article_id
                    ))
                })?;

            let already = already_returned.get(&item.article_id).copied().unwrap_or(0);
            let remaining = original.quantity - already;
            if item.quantity > remaining {
                return Err(AppError::Validation(format!(
                    "Nicht mehr als {remaining} Stück von \"{}\" retournierbar",
                    original.article_name
                )));
            }

            // Refund the returned units' share of the line's paid amount. Taking
            // the difference of cumulative shares makes several partial returns
            // add up to exactly the paid amount, without rounding drift.
            let paid_cents = original.line_total_cents - original.discount_cents;
            let refund_cents = money::cumulative_share(paid_cents, already + item.quantity, original.quantity)
                - money::cumulative_share(paid_cents, already, original.quantity);
            total_refund_cents += refund_cents;
            prepared_items.push(PreparedSaleReturnItem {
                article_id: item.article_id,
                quantity: item.quantity,
                unit_price_cents: original.unit_price_cents,
                refund_cents,
            });
        }

        let prepared = PreparedSaleReturn {
            sale_id: input.sale_id,
            refund_method: input.refund_method,
            total_refund_cents,
            items: prepared_items,
        };

        SaleReturnRepository::create(pool, &prepared).await
    }

    pub async fn list_for_sale(pool: &SqlitePool, sale_id: i64) -> Result<Vec<SaleReturnWithItems>, AppError> {
        SaleReturnRepository::list_for_sale(pool, sale_id).await
    }
}
