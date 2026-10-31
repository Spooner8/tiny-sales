use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{NewProductSubgroup, ProductSubgroup, UpdateProductSubgroup};

pub struct ProductSubgroupRepository;

impl ProductSubgroupRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<ProductSubgroup>, AppError> {
        let rows = sqlx::query_as::<_, ProductSubgroup>(
            "SELECT id, product_group_id, name, active FROM product_subgroup ORDER BY name",
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<ProductSubgroup>, AppError> {
        let row = sqlx::query_as::<_, ProductSubgroup>(
            "SELECT id, product_group_id, name, active FROM product_subgroup WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;
        Ok(row)
    }

    /// Subgroup names only need to be unique within their product group
    /// (e.g. "Einfarbig" exists under both "Stickerei" and "DTF").
    pub async fn name_exists(
        pool: &SqlitePool,
        product_group_id: i64,
        name: &str,
        exclude_id: Option<i64>,
    ) -> Result<bool, AppError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM product_subgroup WHERE product_group_id = ? AND name = ? AND id != ?",
        )
        .bind(product_group_id)
        .bind(name)
        .bind(exclude_id.unwrap_or(0))
        .fetch_one(pool)
        .await?;
        Ok(count > 0)
    }

    pub async fn create(pool: &SqlitePool, input: &NewProductSubgroup) -> Result<ProductSubgroup, AppError> {
        let id = sqlx::query("INSERT INTO product_subgroup (product_group_id, name, active) VALUES (?, ?, 1)")
            .bind(input.product_group_id)
            .bind(&input.name)
            .execute(pool)
            .await?
            .last_insert_rowid();

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Warenuntergruppe {id} nach dem Anlegen nicht gefunden")))
    }

    pub async fn update(pool: &SqlitePool, input: &UpdateProductSubgroup) -> Result<ProductSubgroup, AppError> {
        sqlx::query("UPDATE product_subgroup SET product_group_id = ?, name = ?, active = ? WHERE id = ?")
            .bind(input.product_group_id)
            .bind(&input.name)
            .bind(input.active)
            .bind(input.id)
            .execute(pool)
            .await?;

        Self::find_by_id(pool, input.id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Warenuntergruppe {} nicht gefunden", input.id)))
    }

    pub async fn count_articles(pool: &SqlitePool, product_subgroup_id: i64) -> Result<i64, AppError> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM article WHERE product_subgroup_id = ?")
            .bind(product_subgroup_id)
            .fetch_one(pool)
            .await?;
        Ok(count)
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        sqlx::query("UPDATE product_subgroup SET active = 0 WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
