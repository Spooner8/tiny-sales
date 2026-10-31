use serde::{Deserialize, Serialize};

/// The shop's own details, printed on receipts and shown in the menu.
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
}
