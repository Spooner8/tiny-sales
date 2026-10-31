use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{NewProductGroup, ProductGroup, UpdateProductGroup};

/// Pure data-access layer for product groups - no business rules here,
/// that lives in ProductGroupService.
pub struct ProductGroupRepository;

impl ProductGroupRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<ProductGroup>, AppError> {
        let rows = sqlx::query_as::<_, ProductGroup>("SELECT id, name, active FROM product_group ORDER BY name")
            .fetch_all(pool)
            .await?;
        Ok(rows)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<ProductGroup>, AppError> {
        let row = sqlx::query_as::<_, ProductGroup>("SELECT id, name, active FROM product_group WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row)
    }

    pub async fn name_exists(
        pool: &SqlitePool,
        name: &str,
        exclude_id: Option<i64>,
    ) -> Result<bool, AppError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM product_group WHERE name = ? AND id != ?",
        )
        .bind(name)
        .bind(exclude_id.unwrap_or(0))
        .fetch_one(pool)
        .await?;
        Ok(count > 0)
    }

    pub async fn create(pool: &SqlitePool, input: &NewProductGroup) -> Result<ProductGroup, AppError> {
        let id = sqlx::query("INSERT INTO product_group (name, active) VALUES (?, 1)")
            .bind(&input.name)
            .execute(pool)
            .await?
            .last_insert_rowid();

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Warengruppe {id} nach dem Anlegen nicht gefunden")))
    }

    pub async fn update(pool: &SqlitePool, input: &UpdateProductGroup) -> Result<ProductGroup, AppError> {
        sqlx::query("UPDATE product_group SET name = ?, active = ? WHERE id = ?")
            .bind(&input.name)
            .bind(input.active)
            .bind(input.id)
            .execute(pool)
            .await?;

        Self::find_by_id(pool, input.id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Warengruppe {} nicht gefunden", input.id)))
    }

    pub async fn count_active_articles(pool: &SqlitePool, product_group_id: i64) -> Result<i64, AppError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM article WHERE product_group_id = ? AND active = 1",
        )
        .bind(product_group_id)
        .fetch_one(pool)
        .await?;
        Ok(count)
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        sqlx::query("UPDATE product_group SET active = 0 WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
