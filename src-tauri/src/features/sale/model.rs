use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaymentMethod {
    Cash,
    Twint,
    Card,
    /// Only for customer orders: completed by issuing an invoice.
    Invoice,
    /// Only for refunds: money paid back to the customer's account.
    BankTransfer,
}

impl PaymentMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            PaymentMethod::Cash => "Cash",
            PaymentMethod::Twint => "Twint",
            PaymentMethod::Card => "Card",
            PaymentMethod::Invoice => "Invoice",
            PaymentMethod::BankTransfer => "BankTransfer",
        }
    }

    /// Whether the money is taken at the checkout. An invoice is paid later,
    /// so an order paid by invoice is completed without the checkout.
    pub fn paid_at_checkout(&self) -> bool {
        matches!(self, PaymentMethod::Cash | PaymentMethod::Twint | PaymentMethod::Card)
    }

    /// Ways to pay money back for a return: at the checkout or by transfer.
    pub fn usable_for_refunds(&self) -> bool {
        self.paid_at_checkout() || matches!(self, PaymentMethod::BankTransfer)
    }
}

impl FromStr for PaymentMethod {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Cash" => Ok(Self::Cash),
            "Twint" => Ok(Self::Twint),
            "Card" => Ok(Self::Card),
            "Invoice" => Ok(Self::Invoice),
            "BankTransfer" => Ok(Self::BankTransfer),
            other => Err(AppError::Validation(format!("Unbekannte Zahlart: {other}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sale {
    pub id: i64,
    pub timestamp: String,
    pub payment_method: PaymentMethod,
    pub status: String,
    /// Sum of all lines (after article promotions), before the sale discount.
    pub subtotal_cents: i64,
    /// Discount on the whole sale; total_cents = subtotal_cents - discount_cents.
    pub discount_cents: i64,
    /// Set when the sale discount was entered as a percentage.
    pub discount_percent: Option<f64>,
    /// "percent", "total" (new final total entered) or "amount" (legacy).
    pub discount_kind: Option<String>,
    /// For percentage discounts: whether already discounted lines got it too.
    pub discount_cumulative: Option<bool>,
    pub total_cents: i64,
    pub pickup_number: Option<String>,
    pub cash_given_cents: Option<i64>,
    pub change_cents: Option<i64>,
    /// VAT rate when the sale was booked; None for sales from before VAT was recorded.
    pub vat_rate_percent: Option<f64>,
    /// VAT contained in total_cents.
    pub vat_cents: Option<i64>,
    /// Set for sales that completed a customer order.
    pub customer_order_id: Option<i64>,
    pub customer_name: Option<String>,
    pub customer_company: Option<String>,
    /// Set for sales paid by invoice.
    pub invoice_id: Option<i64>,
    /// Day the invoice was paid; None while it is open.
    pub invoice_paid_on: Option<String>,
}

/// One row of the sales list: a sale, or a return booked against one. A
/// return has a negative total, so the list adds up to the net revenue.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleListEntry {
    pub sale_id: i64,
    /// Set for returns.
    pub return_id: Option<i64>,
    pub timestamp: String,
    /// For returns: how the money was refunded.
    pub payment_method: PaymentMethod,
    pub total_cents: i64,
    pub pickup_number: Option<String>,
    /// For sales of a customer order.
    pub customer_name: Option<String>,
    pub customer_company: Option<String>,
    /// For sales paid by invoice (not set on their returns).
    pub invoice_id: Option<i64>,
    pub invoice_paid_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaleItemDetail {
    pub article_id: i64,
    pub article_code: String,
    pub article_name: String,
    /// The article's current internal number ("Interne Nr.").
    pub article_internal_number: Option<String>,
    pub quantity: i64,
    /// Regular unit price before the article promotion.
    pub list_price_cents: i64,
    /// Unit price charged (after the article promotion and line discount).
    pub unit_price_cents: i64,
    /// Article promotion in percent at the time of sale (0 = none).
    pub article_discount_percent: f64,
    /// "percent" or "amount" when a line discount was given; "price" (a new
    /// unit price) on sales from before line discounts became amounts off.
    pub line_discount_kind: Option<String>,
    /// The percentage, the amount off per unit or the new unit price in Rappen.
    pub line_discount_value: Option<f64>,
    /// quantity * unit_price_cents, before the sale discount.
    pub line_total_cents: i64,
    /// This line's share of the sale discount.
    pub discount_cents: i64,
    /// Extra information from the customer order line.
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleWithItems {
    pub sale: Sale,
    pub items: Vec<SaleItemDetail>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSaleItem {
    pub article_id: i64,
    pub quantity: i64,
    pub discount: Option<LineDiscountInput>,
}

/// Discount on a single line, entered at checkout or in a customer order.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LineDiscountInput {
    /// Percent off the current (promotion) price.
    Percent { value: f64 },
    /// Amount off the current (promotion) price per unit, in Rappen.
    Amount { value: i64 },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSale {
    pub items: Vec<NewSaleItem>,
    pub payment_method: PaymentMethod,
    pub cash_given_cents: Option<i64>,
    pub pickup_number: Option<String>,
    pub discount: Option<SaleDiscountInput>,
    /// The open sale this sale was rung up in; it is deleted on completion.
    pub open_sale_id: Option<String>,
}

/// Discount on the whole sale as entered at checkout, e.g.
/// `{ "kind": "percent", "value": 10, "cumulative": false }` or
/// `{ "kind": "total", "value": 4000 }`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SaleDiscountInput {
    /// `cumulative = false` leaves lines that already have a promotion or
    /// line discount out of the sale discount.
    Percent { value: f64, cumulative: bool },
    /// The new final total in Rappen; the difference is the discount.
    Total { value: i64 },
}

/// Fully validated/priced sale, ready for persistence. Built by
/// SaleService from a NewSale before handing it to the repository.
pub struct PreparedSale {
    pub payment_method: PaymentMethod,
    pub subtotal_cents: i64,
    pub discount_cents: i64,
    pub discount_percent: Option<f64>,
    pub discount_kind: Option<&'static str>,
    pub discount_cumulative: Option<bool>,
    pub total_cents: i64,
    pub cash_given_cents: Option<i64>,
    pub change_cents: Option<i64>,
    pub vat_rate_percent: f64,
    pub vat_cents: i64,
    pub pickup_number: Option<String>,
    pub open_sale_id: Option<String>,
    pub items: Vec<PreparedSaleItem>,
}

pub struct PreparedSaleItem {
    pub article_id: i64,
    pub quantity: i64,
    pub list_price_cents: i64,
    pub unit_price_cents: i64,
    pub article_discount_percent: f64,
    pub line_discount_kind: Option<&'static str>,
    pub line_discount_value: Option<f64>,
    pub discount_cents: i64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DailyRevenue {
    pub day: String,
    pub total_cents: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProductGroupRevenue {
    pub product_group_id: i64,
    pub product_group_name: String,
    pub total_cents: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArticleRevenue {
    pub article_id: i64,
    pub article_name: String,
    pub total_cents: i64,
}
