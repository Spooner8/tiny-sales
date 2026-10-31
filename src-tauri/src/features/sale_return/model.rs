use serde::{Deserialize, Serialize};

use crate::features::sale::model::PaymentMethod;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleReturn {
    pub id: i64,
    pub sale_id: i64,
    pub timestamp: String,
    pub refund_method: PaymentMethod,
    pub total_refund_cents: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaleReturnItemDetail {
    pub article_id: i64,
    pub article_code: String,
    pub article_name: String,
    pub quantity: i64,
    pub unit_price_cents: i64,
    /// Amount actually refunded for this line.
    pub line_total_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleReturnWithItems {
    #[serde(rename = "return")]
    pub sale_return: SaleReturn,
    pub items: Vec<SaleReturnItemDetail>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSaleReturnItem {
    pub article_id: i64,
    pub quantity: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSaleReturn {
    pub sale_id: i64,
    pub refund_method: PaymentMethod,
    pub items: Vec<NewSaleReturnItem>,
}

/// Fully validated/priced return, ready for persistence.
pub struct PreparedSaleReturn {
    pub sale_id: i64,
    pub refund_method: PaymentMethod,
    pub total_refund_cents: i64,
    pub items: Vec<PreparedSaleReturnItem>,
}

pub struct PreparedSaleReturnItem {
    pub article_id: i64,
    pub quantity: i64,
    pub unit_price_cents: i64,
    /// Amount refunded for this line (its share of what was actually paid).
    pub refund_cents: i64,
}
