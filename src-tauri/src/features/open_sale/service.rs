use std::collections::HashSet;

use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{OpenSale, SaveOpenSale};
use super::repository::OpenSaleRepository;

// "price" (a new unit price) may still be stored in sales opened before
// line discounts became amounts off; the checkout converts it.
const LINE_DISCOUNT_KINDS: [&str; 4] = ["none", "percent", "amount", "price"];
const SALE_DISCOUNT_KINDS: [&str; 3] = ["none", "percent", "total"];

/// Open (not yet completed) sales. Only their shape is validated here: the
/// discounts are drafts and get validated when the sale is completed.
pub struct OpenSaleService;

impl OpenSaleService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<OpenSale>, AppError> {
        OpenSaleRepository::list(pool).await
    }

    pub async fn save(pool: &SqlitePool, input: SaveOpenSale) -> Result<(), AppError> {
        if input.id.trim().is_empty() {
            return Err(AppError::Validation("Offener Verkauf ohne ID".into()));
        }
        if !SALE_DISCOUNT_KINDS.contains(&input.discount.kind.as_str()) {
            return Err(AppError::Validation(format!("Unbekannte Rabattart: {}", input.discount.kind)));
        }
        let mut seen = HashSet::new();
        for item in &input.items {
            if item.quantity <= 0 {
                return Err(AppError::Validation("Menge muss grösser als 0 sein".into()));
            }
            if !seen.insert(item.article_id) {
                return Err(AppError::Validation(format!(
                    "Artikel {} ist doppelt im Warenkorb",
                    item.article_id
                )));
            }
            if !LINE_DISCOUNT_KINDS.contains(&item.discount.kind.as_str()) {
                return Err(AppError::Validation(format!("Unbekannte Rabattart: {}", item.discount.kind)));
            }
        }
        let label = input
            .label
            .as_deref()
            .map(str::trim)
            .filter(|label| !label.is_empty())
            .map(String::from);
        OpenSaleRepository::save(pool, &SaveOpenSale { label, ..input }).await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        OpenSaleRepository::delete(pool, id).await
    }
}
