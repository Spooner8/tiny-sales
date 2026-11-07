use serde::{Deserialize, Serialize};

use crate::features::sale::model::{LineDiscountInput, PaymentMethod, SaleDiscountInput, SaleWithItems};

/// Production states of an order, in their usual order. Independent of
/// completion: an order can be delivered before its invoice is paid.
pub const ORDER_STATUSES: [&str; 6] = [
    "open",
    "material_required",
    "material_ordered",
    "ready_for_production",
    "produced",
    "delivered",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerOrderItem {
    pub id: i64,
    pub article_id: i64,
    pub article_code: String,
    pub article_name: String,
    pub article_internal_number: Option<String>,
    pub quantity: i64,
    /// Regular unit price when the line was added.
    pub list_price_cents: i64,
    /// Unit price after the article promotion when the line was added.
    pub sale_price_cents: i64,
    pub article_discount_percent: f64,
    pub discount: Option<LineDiscountInput>,
    /// sale_price_cents after the line discount.
    pub unit_price_cents: i64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerOrder {
    pub id: i64,
    pub customer_id: i64,
    pub customer_name: String,
    pub customer_company: Option<String>,
    pub status: String,
    pub payment_method: PaymentMethod,
    pub discount: Option<SaleDiscountInput>,
    /// Set once the order is billed: paid at the checkout or invoiced.
    pub sale_id: Option<i64>,
    pub invoice_id: Option<i64>,
    /// Day the invoice was paid; None while it is open.
    pub invoice_paid_on: Option<String>,
    /// Delivered and paid (or returned): nothing is left to do.
    pub done: bool,
    pub created_at: String,
    pub updated_at: String,
    pub items: Vec<CustomerOrderItem>,
    pub subtotal_cents: i64,
    pub discount_cents: i64,
    pub total_cents: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomerOrderItem {
    /// Set for lines that were saved before; they keep their prices.
    pub id: Option<i64>,
    pub article_id: i64,
    pub quantity: i64,
    pub discount: Option<LineDiscountInput>,
    pub note: Option<String>,
}

/// Full state of an order; saving replaces its lines. Without id, a new
/// order is created.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomerOrder {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub status: String,
    pub payment_method: PaymentMethod,
    pub discount: Option<SaleDiscountInput>,
    pub items: Vec<SaveCustomerOrderItem>,
}

/// Completes an order: at the checkout (cash, Twint, card) or by invoice.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteCustomerOrder {
    pub order_id: i64,
    pub payment_method: PaymentMethod,
    pub cash_given_cents: Option<i64>,
    pub discount: Option<SaleDiscountInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletedCustomerOrder {
    pub sale: SaleWithItems,
    /// Set when the order was paid by invoice.
    pub invoice_id: Option<i64>,
}

/// A stored order line, as the repository returns it.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CustomerOrderItemRecord {
    pub id: i64,
    pub customer_order_id: i64,
    pub article_id: i64,
    pub article_code: String,
    pub article_name: String,
    pub article_internal_number: Option<String>,
    pub quantity: i64,
    pub list_price_cents: i64,
    pub sale_price_cents: i64,
    pub article_discount_percent: f64,
    pub line_discount_kind: Option<String>,
    pub line_discount_value: Option<f64>,
    pub note: Option<String>,
}

/// A stored order, as the repository returns it.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CustomerOrderRecord {
    pub id: i64,
    pub customer_id: i64,
    pub customer_name: String,
    pub customer_company: Option<String>,
    pub status: String,
    pub payment_method: String,
    pub discount_kind: Option<String>,
    pub discount_value: Option<f64>,
    pub discount_cumulative: bool,
    pub sale_id: Option<i64>,
    pub invoice_id: Option<i64>,
    pub invoice_paid_on: Option<String>,
    /// Total of the sale; None until the order is billed.
    pub sale_total_cents: Option<i64>,
    pub refunded_cents: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// A validated order line ready to be stored.
pub struct PreparedOrderItem {
    pub id: Option<i64>,
    pub article_id: i64,
    pub quantity: i64,
    pub list_price_cents: i64,
    pub sale_price_cents: i64,
    pub article_discount_percent: f64,
    pub line_discount_kind: Option<&'static str>,
    pub line_discount_value: Option<f64>,
    pub note: Option<String>,
}
