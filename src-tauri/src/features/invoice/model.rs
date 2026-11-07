use serde::Serialize;

use crate::features::customer::model::Customer;
use crate::features::sale::model::SaleWithItems;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    /// The invoice number.
    pub id: i64,
    pub sale_id: i64,
    pub created_at: String,
    /// "YYYY-MM-DD"
    pub due_date: String,
    /// Day the payment arrived ("YYYY-MM-DD"); None while it is open.
    pub paid_on: Option<String>,
    /// Whether the issued PDF is stored yet.
    pub has_pdf: bool,
}

/// Where an invoice stands. Overdue counts from the latest deadline, i.e.
/// that of the last reminder if there is one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InvoiceStatus {
    Open,
    Overdue,
    Paid,
    /// Everything was returned, so nothing is owed anymore.
    Refunded,
}

/// A stored invoice with its sums, as the repository returns it.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct InvoiceOverviewRecord {
    pub id: i64,
    pub sale_id: i64,
    pub order_id: i64,
    pub customer_name: String,
    pub customer_company: Option<String>,
    pub order_status: String,
    pub created_at: String,
    pub due_date: String,
    pub paid_on: Option<String>,
    pub total_cents: i64,
    pub refunded_cents: i64,
    pub fees_cents: i64,
    pub reminder_level: i64,
    pub reminder_due_date: Option<String>,
}

/// One row of the invoice overview.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceOverview {
    pub id: i64,
    /// The payment reference, formatted as printed.
    pub reference: String,
    /// Every reference a payment can carry, without spaces, for searching.
    pub reference_search: String,
    pub sale_id: i64,
    pub order_id: i64,
    pub customer_name: String,
    pub customer_company: Option<String>,
    /// Production status of the order.
    pub order_status: String,
    pub created_at: String,
    /// The latest deadline: that of the last reminder, or of the invoice.
    pub due_date: String,
    pub paid_on: Option<String>,
    pub total_cents: i64,
    /// Refunds booked as returns of this sale.
    pub refunded_cents: i64,
    /// Sum of the reminder fees so far.
    pub fees_cents: i64,
    /// What is still owed: total - refunds + fees.
    pub outstanding_cents: i64,
    /// Highest reminder level so far, 0 if none.
    pub reminder_level: i64,
    pub status: InvoiceStatus,
    /// Overdue, and not all reminder levels are used yet.
    pub can_remind: bool,
}

/// A reminder as issued.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceReminder {
    pub id: i64,
    pub invoice_id: i64,
    /// 1 = payment reminder, 2 and 3 = first and second dunning letter.
    pub level: i64,
    pub created_at: String,
    /// The new payment deadline ("YYYY-MM-DD").
    pub due_date: String,
    /// The fee added by this reminder.
    pub fee_cents: i64,
    /// What the customer is asked to pay, including all fees so far.
    pub amount_cents: i64,
    /// Whether the issued PDF is stored yet.
    pub has_pdf: bool,
}

/// An address as printed on the payment part.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceAddress {
    pub name: String,
    /// Street and house number.
    pub street: String,
    /// e.g. "8000 Zürich"
    pub postal_city: String,
}

/// The QR payment part of an invoice.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoicePayment {
    /// In blocks of four, as printed.
    pub iban: String,
    /// Formatted as printed.
    pub reference: String,
    /// The text to encode in the Swiss QR code.
    pub qr_payload: String,
    pub creditor: InvoiceAddress,
    /// None if the customer's address is incomplete: then the payer fills it in.
    pub debtor: Option<InvoiceAddress>,
    pub amount_cents: i64,
    pub message: String,
}

/// Everything needed to render an invoice.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceDetail {
    pub invoice: Invoice,
    pub overview: InvoiceOverview,
    pub reminders: Vec<InvoiceReminder>,
    pub order_id: i64,
    pub customer: Customer,
    pub sale: SaleWithItems,
    /// None if the company profile no longer allows a payment part (e.g.
    /// the IBAN was removed); `payment_error` says why. The stored PDF is
    /// unaffected.
    pub payment: Option<InvoicePayment>,
    pub payment_error: Option<String>,
}

/// Everything needed to render a reminder, with the sums as they were when
/// it was issued.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceReminderDetail {
    pub reminder: InvoiceReminder,
    pub invoice: Invoice,
    /// When the previous reminder went out.
    pub previous_reminder_at: Option<String>,
    pub customer: Customer,
    pub total_cents: i64,
    /// Refunds deducted when the reminder was issued.
    pub refunded_cents: i64,
    /// All fees up to and including this reminder.
    pub fees_cents: i64,
    /// None if the company profile no longer allows a payment part.
    pub payment: Option<InvoicePayment>,
    pub payment_error: Option<String>,
}
