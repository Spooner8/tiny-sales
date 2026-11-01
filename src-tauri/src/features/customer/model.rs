use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    /// Street and house number in one line.
    pub street: Option<String>,
    pub postal_code: Option<String>,
    pub city: Option<String>,
    /// ISO 3166 code, e.g. "CH" or "DE".
    pub country: String,
    pub phone: Option<String>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    /// "male" or "female"; used for the salutation on invoices.
    pub gender: Option<String>,
    pub company: Option<String>,
    pub note: Option<String>,
    pub additional_info: Option<String>,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Customer {
    pub fn full_name(&self) -> String {
        format!("{} {}", self.first_name, self.last_name)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCustomer {
    pub first_name: String,
    pub last_name: String,
    pub street: Option<String>,
    pub postal_code: Option<String>,
    pub city: Option<String>,
    pub country: String,
    pub phone: Option<String>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub gender: Option<String>,
    pub company: Option<String>,
    pub note: Option<String>,
    pub additional_info: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomer {
    pub id: i64,
    pub active: bool,
    #[serde(flatten)]
    pub fields: NewCustomer,
}
