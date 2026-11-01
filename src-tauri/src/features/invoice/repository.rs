use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppError;

use super::model::Invoice;

pub struct InvoiceRepository;

impl InvoiceRepository {
    /// Creates the invoice for a sale, due `payment_days` from today.
    pub async fn create_in(tx: &mut Transaction<'_, Sqlite>, sale_id: i64, payment_days: i64) -> Result<i64, AppError> {
        let id = sqlx::query("INSERT INTO invoice (sale_id, due_date) VALUES (?, date('now', 'localtime', ?))")
            .bind(sale_id)
            .bind(format!("+{payment_days} days"))
            .execute(&mut **tx)
            .await?
            .last_insert_rowid();
        Ok(id)
    }

    pub async fn find(pool: &SqlitePool, id: i64) -> Result<Option<Invoice>, AppError> {
        let invoice = sqlx::query_as::<_, Invoice>(
            "SELECT id, sale_id, created_at, due_date, paid_on, pdf IS NOT NULL as has_pdf FROM invoice WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;
        Ok(invoice)
    }

    /// The order and customer the invoiced sale belongs to.
    pub async fn order_of_sale(pool: &SqlitePool, sale_id: i64) -> Result<Option<(i64, i64)>, AppError> {
        let row = sqlx::query_as::<_, (i64, i64)>("SELECT id, customer_id FROM customer_order WHERE sale_id = ?")
            .bind(sale_id)
            .fetch_optional(pool)
            .await?;
        Ok(row)
    }

    pub async fn pdf(pool: &SqlitePool, id: i64) -> Result<Option<Vec<u8>>, AppError> {
        let pdf: Option<Option<Vec<u8>>> = sqlx::query_scalar("SELECT pdf FROM invoice WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(pdf.flatten())
    }

    /// Stores the issued PDF; a PDF stored before is never replaced.
    pub async fn store_pdf(pool: &SqlitePool, id: i64, pdf: &[u8]) -> Result<(), AppError> {
        sqlx::query("UPDATE invoice SET pdf = ? WHERE id = ? AND pdf IS NULL")
            .bind(pdf)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn set_paid_on(pool: &SqlitePool, id: i64, paid_on: Option<&str>) -> Result<(), AppError> {
        sqlx::query("UPDATE invoice SET paid_on = ? WHERE id = ?")
            .bind(paid_on)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
