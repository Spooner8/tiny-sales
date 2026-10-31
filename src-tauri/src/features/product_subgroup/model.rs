use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProductSubgroup {
    pub id: i64,
    pub product_group_id: i64,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProductSubgroup {
    pub product_group_id: i64,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductSubgroup {
    pub id: i64,
    pub product_group_id: i64,
    pub name: String,
    pub active: bool,
}
