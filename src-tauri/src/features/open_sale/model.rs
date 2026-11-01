use serde::{Deserialize, Serialize};

/// A line discount as typed at the checkout, before validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineDiscountDraft {
    /// "none", "percent" or "amount" ("price" in sales opened before amounts off).
    pub kind: String,
    pub input: String,
}

/// The sale discount as typed at the checkout, before validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleDiscountDraft {
    /// "none", "percent" or "total".
    pub kind: String,
    pub input: String,
    pub cumulative: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSaleItem {
    pub article_id: i64,
    pub quantity: i64,
    pub discount: LineDiscountDraft,
}

/// A sale started at the checkout but not completed yet. Its items reserve
/// stock; nothing is booked until it is completed via `create_sale`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSale {
    pub id: String,
    pub number: i64,
    pub label: Option<String>,
    pub discount: SaleDiscountDraft,
    pub pickup_number: String,
    pub created_at: String,
    pub updated_at: String,
    pub items: Vec<OpenSaleItem>,
}

/// Full snapshot of an open sale; saving replaces the stored state.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOpenSale {
    pub id: String,
    pub number: i64,
    pub label: Option<String>,
    pub discount: SaleDiscountDraft,
    pub pickup_number: String,
    pub items: Vec<OpenSaleItem>,
}
