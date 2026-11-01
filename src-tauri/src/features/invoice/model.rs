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
    pub order_id: i64,
    pub customer: Customer,
    pub sale: SaleWithItems,
    /// None if the company profile no longer allows a payment part (e.g.
    /// the IBAN was removed); `payment_error` says why. The stored PDF is
    /// unaffected.
    pub payment: Option<InvoicePayment>,
    pub payment_error: Option<String>,
}
