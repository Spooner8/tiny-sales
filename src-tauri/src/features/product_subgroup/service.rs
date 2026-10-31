use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::product_group::repository::ProductGroupRepository;

use super::model::{NewProductSubgroup, ProductSubgroup, UpdateProductSubgroup};
use super::repository::ProductSubgroupRepository;

/// Business rules for product subgroups: validation, per-group duplicate
/// check, and keeping articles consistent with their subgroup's group.
pub struct ProductSubgroupService;

impl ProductSubgroupService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<ProductSubgroup>, AppError> {
        ProductSubgroupRepository::list(pool).await
    }

    pub async fn create(pool: &SqlitePool, input: NewProductSubgroup) -> Result<ProductSubgroup, AppError> {
        let name = Self::validate(pool, input.product_group_id, &input.name, None).await?;
        ProductSubgroupRepository::create(pool, &NewProductSubgroup { name, ..input }).await
    }

    pub async fn update(pool: &SqlitePool, input: UpdateProductSubgroup) -> Result<ProductSubgroup, AppError> {
        let name = Self::validate(pool, input.product_group_id, &input.name, Some(input.id)).await?;
        let existing = ProductSubgroupRepository::find_by_id(pool, input.id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Warenuntergruppe {} nicht gefunden", input.id)))?;
        // Articles store their product group alongside the subgroup, so moving
        // a subgroup that is in use would leave them pointing at the old group.
        if existing.product_group_id != input.product_group_id {
            let in_use = ProductSubgroupRepository::count_articles(pool, input.id).await?;
            if in_use > 0 {
                return Err(AppError::Validation(format!(
                    "Warengruppe kann nicht geändert werden: {in_use} Artikel verwenden diese Warenuntergruppe noch"
                )));
            }
        }
        ProductSubgroupRepository::update(pool, &UpdateProductSubgroup { name, ..input }).await
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        ProductSubgroupRepository::deactivate(pool, id).await
    }

    async fn validate(
        pool: &SqlitePool,
        product_group_id: i64,
        name: &str,
        exclude_id: Option<i64>,
    ) -> Result<String, AppError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::Validation("Name darf nicht leer sein".into()));
        }
        if ProductGroupRepository::find_by_id(pool, product_group_id)
            .await?
            .is_none()
        {
            return Err(AppError::Validation("Warengruppe existiert nicht".into()));
        }
        if ProductSubgroupRepository::name_exists(pool, product_group_id, &name, exclude_id).await? {
            return Err(AppError::Validation(format!(
                "Warenuntergruppe \"{name}\" existiert in dieser Warengruppe bereits"
            )));
        }
        Ok(name)
    }
}
