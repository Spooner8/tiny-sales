use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppError;

use super::model::{Invoice, InvoiceOverviewRecord, InvoiceReminder};

const SELECT_OVERVIEW: &str = "
    SELECT invoice.id as id, invoice.sale_id as sale_id, customer_order.id as order_id,
           customer.first_name || ' ' || customer.last_name as customer_name, customer.company as customer_company,
           customer_order.status as order_status, invoice.created_at as created_at, invoice.due_date as due_date,
           invoice.paid_on as paid_on, sale.total_cents as total_cents,
           (SELECT COALESCE(SUM(total_refund_cents), 0) FROM sale_return WHERE sale_return.sale_id = invoice.sale_id) as refunded_cents,
           (SELECT COALESCE(SUM(fee_cents), 0) FROM invoice_reminder WHERE invoice_reminder.invoice_id = invoice.id) as fees_cents,
           (SELECT COALESCE(MAX(level), 0) FROM invoice_reminder WHERE invoice_reminder.invoice_id = invoice.id) as reminder_level,
           (SELECT due_date FROM invoice_reminder WHERE invoice_reminder.invoice_id = invoice.id
            ORDER BY level DESC LIMIT 1) as reminder_due_date
    FROM invoice
    JOIN sale ON sale.id = invoice.sale_id
    JOIN customer_order ON customer_order.sale_id = invoice.sale_id
    JOIN customer ON customer.id = customer_order.customer_id";

const SELECT_REMINDER: &str = "
    SELECT id, invoice_id, level, created_at, due_date, fee_cents, amount_cents, pdf IS NOT NULL as has_pdf
    FROM invoice_reminder";

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

    /// All invoices, newest first.
    pub async fn list_overview(pool: &SqlitePool) -> Result<Vec<InvoiceOverviewRecord>, AppError> {
        let rows = sqlx::query_as::<_, InvoiceOverviewRecord>(&format!("{SELECT_OVERVIEW} ORDER BY invoice.id DESC"))
            .fetch_all(pool)
            .await?;
        Ok(rows)
    }

    pub async fn find_overview(pool: &SqlitePool, id: i64) -> Result<Option<InvoiceOverviewRecord>, AppError> {
        let row = sqlx::query_as::<_, InvoiceOverviewRecord>(&format!("{SELECT_OVERVIEW} WHERE invoice.id = ?"))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row)
    }

    /// Today in the shop's time zone, as dates are stored ("YYYY-MM-DD").
    pub async fn today(pool: &SqlitePool) -> Result<String, AppError> {
        let today: String = sqlx::query_scalar("SELECT date('now', 'localtime')").fetch_one(pool).await?;
        Ok(today)
    }

    /// Creates the reminder, due `payment_days` from today. An invoice has
    /// each level only once, also when two computers remind at the same time.
    pub async fn create_reminder(
        pool: &SqlitePool,
        invoice_id: i64,
        level: i64,
        payment_days: i64,
        fee_cents: i64,
        amount_cents: i64,
    ) -> Result<i64, AppError> {
        let id = sqlx::query(
            "INSERT INTO invoice_reminder (invoice_id, level, due_date, fee_cents, amount_cents)
             VALUES (?, ?, date('now', 'localtime', ?), ?, ?)",
        )
        .bind(invoice_id)
        .bind(level)
        .bind(format!("+{payment_days} days"))
        .bind(fee_cents)
        .bind(amount_cents)
        .execute(pool)
        .await?
        .last_insert_rowid();
        Ok(id)
    }

    pub async fn find_reminder(pool: &SqlitePool, id: i64) -> Result<Option<InvoiceReminder>, AppError> {
        let reminder = sqlx::query_as::<_, InvoiceReminder>(&format!("{SELECT_REMINDER} WHERE id = ?"))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(reminder)
    }

    /// The reminders of an invoice, by level.
    pub async fn reminders_of(pool: &SqlitePool, invoice_id: i64) -> Result<Vec<InvoiceReminder>, AppError> {
        let reminders = sqlx::query_as::<_, InvoiceReminder>(&format!(
            "{SELECT_REMINDER} WHERE invoice_id = ? ORDER BY level"
        ))
        .bind(invoice_id)
        .fetch_all(pool)
        .await?;
        Ok(reminders)
    }

    pub async fn reminder_pdf(pool: &SqlitePool, id: i64) -> Result<Option<Vec<u8>>, AppError> {
        let pdf: Option<Option<Vec<u8>>> = sqlx::query_scalar("SELECT pdf FROM invoice_reminder WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(pdf.flatten())
    }

    /// Stores the issued PDF; a PDF stored before is never replaced.
    pub async fn store_reminder_pdf(pool: &SqlitePool, id: i64, pdf: &[u8]) -> Result<(), AppError> {
        sqlx::query("UPDATE invoice_reminder SET pdf = ? WHERE id = ? AND pdf IS NULL")
            .bind(pdf)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
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
