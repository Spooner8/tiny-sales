use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{NewProductGroup, ProductGroup, UpdateProductGroup};
use super::repository::ProductGroupRepository;

/// Business rules for product groups (validation, duplicate check,
/// guarding against deactivation while articles still use it).
pub struct ProductGroupService;

impl ProductGroupService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<ProductGroup>, AppError> {
        ProductGroupRepository::list(pool).await
    }

    pub async fn create(pool: &SqlitePool, input: NewProductGroup) -> Result<ProductGroup, AppError> {
        let name = Self::validate_name(&input.name)?;
        if ProductGroupRepository::name_exists(pool, &name, None).await? {
            return Err(AppError::Validation(format!(
                "Warengruppe \"{name}\" existiert bereits"
            )));
        }
        ProductGroupRepository::create(pool, &NewProductGroup { name }).await
    }

    pub async fn update(pool: &SqlitePool, input: UpdateProductGroup) -> Result<ProductGroup, AppError> {
        let name = Self::validate_name(&input.name)?;
        if ProductGroupRepository::name_exists(pool, &name, Some(input.id)).await? {
            return Err(AppError::Validation(format!(
                "Warengruppe \"{name}\" existiert bereits"
            )));
        }
        ProductGroupRepository::update(
            pool,
            &UpdateProductGroup {
                name,
                ..input
            },
        )
        .await
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        let in_use = ProductGroupRepository::count_active_articles(pool, id).await?;
        if in_use > 0 {
            return Err(AppError::Validation(format!(
                "Warengruppe kann nicht deaktiviert werden: {in_use} aktive(r) Artikel verwenden sie noch"
            )));
        }
        ProductGroupRepository::deactivate(pool, id).await
    }

    fn validate_name(name: &str) -> Result<String, AppError> {
        let trimmed = name.trim().to_string();
        if trimmed.is_empty() {
            return Err(AppError::Validation("Name darf nicht leer sein".into()));
        }
        Ok(trimmed)
    }
}
