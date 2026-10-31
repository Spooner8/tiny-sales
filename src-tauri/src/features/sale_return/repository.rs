use std::collections::HashMap;
use std::str::FromStr;

use sqlx::{FromRow, SqlitePool};

use crate::error::AppError;
use crate::features::sale::model::PaymentMethod;

use super::model::{PreparedSaleReturn, SaleReturn, SaleReturnItemDetail, SaleReturnWithItems};

#[derive(FromRow)]
struct SaleReturnRow {
    id: i64,
    sale_id: i64,
    timestamp: String,
    refund_method: String,
    total_refund_cents: i64,
}

impl SaleReturnRow {
    fn into_domain(self) -> Result<SaleReturn, AppError> {
        Ok(SaleReturn {
            id: self.id,
            sale_id: self.sale_id,
            timestamp: self.timestamp,
            refund_method: PaymentMethod::from_str(&self.refund_method)?,
            total_refund_cents: self.total_refund_cents,
        })
    }
}

pub struct SaleReturnRepository;

impl SaleReturnRepository {
    pub async fn create(
        pool: &SqlitePool,
        prepared: &PreparedSaleReturn,
    ) -> Result<SaleReturnWithItems, AppError> {
        let mut tx = pool.begin().await?;

        let return_id = sqlx::query(
            "INSERT INTO sale_return (sale_id, refund_method, total_refund_cents) VALUES (?, ?, ?)",
        )
        .bind(prepared.sale_id)
        .bind(prepared.refund_method.as_str())
        .bind(prepared.total_refund_cents)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        for item in &prepared.items {
            sqlx::query(
                "INSERT INTO sale_return_item (sale_return_id, article_id, quantity, unit_price_cents, refund_cents)
                 VALUES (?, ?, ?, ?, ?)",
            )
            .bind(return_id)
            .bind(item.article_id)
            .bind(item.quantity)
            .bind(item.unit_price_cents)
            .bind(item.refund_cents)
            .execute(&mut *tx)
            .await?;

            sqlx::query("UPDATE article SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(item.quantity)
                .bind(item.article_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Self::find_with_items(pool, return_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Retoure {return_id} nach dem Anlegen nicht gefunden")))
    }

    pub async fn find_with_items(pool: &SqlitePool, id: i64) -> Result<Option<SaleReturnWithItems>, AppError> {
        let row = sqlx::query_as::<_, SaleReturnRow>(
            "SELECT id, sale_id, timestamp, refund_method, total_refund_cents FROM sale_return WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        let Some(row) = row else { return Ok(None) };
        let items = Self::items_for(pool, row.id).await?;
        Ok(Some(SaleReturnWithItems {
            sale_return: row.into_domain()?,
            items,
        }))
    }

    pub async fn list_for_sale(pool: &SqlitePool, sale_id: i64) -> Result<Vec<SaleReturnWithItems>, AppError> {
        let rows = sqlx::query_as::<_, SaleReturnRow>(
            "SELECT id, sale_id, timestamp, refund_method, total_refund_cents FROM sale_return WHERE sale_id = ? ORDER BY timestamp",
        )
        .bind(sale_id)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            let items = Self::items_for(pool, row.id).await?;
            result.push(SaleReturnWithItems {
                sale_return: row.into_domain()?,
                items,
            });
        }
        Ok(result)
    }

    pub async fn returned_quantities(pool: &SqlitePool, sale_id: i64) -> Result<HashMap<i64, i64>, AppError> {
        let rows: Vec<(i64, i64)> = sqlx::query_as(
            "SELECT sale_return_item.article_id, SUM(sale_return_item.quantity)
             FROM sale_return_item
             JOIN sale_return ON sale_return_item.sale_return_id = sale_return.id
             WHERE sale_return.sale_id = ?
             GROUP BY sale_return_item.article_id",
        )
        .bind(sale_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().collect())
    }

    async fn items_for(pool: &SqlitePool, sale_return_id: i64) -> Result<Vec<SaleReturnItemDetail>, AppError> {
        let items = sqlx::query_as::<_, SaleReturnItemDetail>(
            "SELECT sale_return_item.article_id as article_id, article.code as article_code, article.name as article_name,
                    sale_return_item.quantity as quantity, sale_return_item.unit_price_cents as unit_price_cents,
                    sale_return_item.refund_cents as line_total_cents
             FROM sale_return_item JOIN article ON sale_return_item.article_id = article.id
             WHERE sale_return_item.sale_return_id = ?",
        )
        .bind(sale_return_id)
        .fetch_all(pool)
        .await?;
        Ok(items)
    }
}
