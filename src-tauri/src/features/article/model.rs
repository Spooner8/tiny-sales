use serde::{Deserialize, Serialize};

/// Another article attached to this one (e.g. a finishing applied to a
/// base article), with the price actually charged for it here (the
/// component's own price, unless overridden for this specific link).
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArticleComponentDetail {
    pub component_article_id: i64,
    pub code: String,
    pub name: String,
    pub internal_number: Option<String>,
    pub price_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub product_group_id: i64,
    pub product_subgroup_id: i64,
    /// Shown as "Interne Nr." in the app.
    pub internal_number: Option<String>,
    pub description: Option<String>,
    /// Only finishings can be attached to other articles as components.
    pub is_finishing: bool,
    pub price_cents: i64,
    pub stock: i64,
    pub active: bool,
    pub discontinued: bool,
    pub created_at: String,
    pub updated_at: String,
    pub components: Vec<ArticleComponentDetail>,
    /// price_cents plus the sum of all linked components' effective prices.
    pub total_price_cents: i64,
    /// Promotion in percent (0 = none).
    pub discount_percent: f64,
    /// What is actually charged: total_price_cents after the promotion,
    /// rounded to 5 Rappen.
    pub sale_price_cents: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewArticleComponentLink {
    pub component_article_id: i64,
    pub price_override_cents: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewArticle {
    pub name: String,
    pub product_group_id: i64,
    pub product_subgroup_id: i64,
    pub internal_number: Option<String>,
    pub description: Option<String>,
    pub is_finishing: bool,
    pub price_cents: i64,
    pub stock: i64,
    pub discontinued: bool,
    pub discount_percent: f64,
    pub component_links: Vec<NewArticleComponentLink>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateArticle {
    pub id: i64,
    pub name: String,
    pub product_group_id: i64,
    pub product_subgroup_id: i64,
    pub internal_number: Option<String>,
    pub description: Option<String>,
    pub is_finishing: bool,
    pub price_cents: i64,
    pub stock: i64,
    pub active: bool,
    pub discontinued: bool,
    pub discount_percent: f64,
    pub component_links: Vec<NewArticleComponentLink>,
}
