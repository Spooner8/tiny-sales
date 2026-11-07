use serde::{Deserialize, Serialize};

/// The shop's own details, printed on receipts and invoices and shown in the menu.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CompanyProfile {
    pub name: String,
    pub street: String,
    /// Postal code and city in one line, e.g. "8000 Zürich".
    pub postal_city: String,
    pub phone: String,
    pub website: String,
    pub vat_number: String,
    /// First footer line on the receipt, e.g. a thank-you.
    pub receipt_thanks: String,
    /// Second, highlighted footer line, e.g. "Ihr Team von ...".
    pub receipt_signature: String,
    /// Logo for receipt and menu as a data URL.
    pub logo: Option<String>,
    /// Optional square mark for the collapsed menu as a data URL.
    pub logo_mark: Option<String>,
    /// Account for the QR payment part of invoices (IBAN or QR-IBAN).
    pub iban: String,
    /// Payment term of invoices in days.
    pub invoice_payment_days: i64,
    /// VAT rate for new sales in percent; 0 shows no VAT.
    pub vat_rate_percent: f64,
    /// Payment term of reminders in days.
    pub reminder_payment_days: i64,
    /// Fee per dunning letter; the payment reminder itself is free.
    pub reminder_fee_cents: i64,
}
