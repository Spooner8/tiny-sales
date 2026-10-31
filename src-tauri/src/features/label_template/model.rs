use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LabelTemplate {
    pub id: i64,
    pub name: String,
    pub paper_size: String,
    /// "portrait" or "landscape".
    pub orientation: String,
    pub columns: i64,
    pub rows: i64,
    pub label_width_mm: f64,
    pub label_height_mm: f64,
    pub gap_x_mm: f64,
    pub gap_y_mm: f64,
    pub margin_x_mm: f64,
    pub margin_y_mm: f64,
    pub active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewLabelTemplate {
    pub name: String,
    pub paper_size: String,
    /// "portrait" or "landscape".
    pub orientation: String,
    pub columns: i64,
    pub rows: i64,
    pub label_width_mm: f64,
    pub label_height_mm: f64,
    pub gap_x_mm: f64,
    pub gap_y_mm: f64,
    pub margin_x_mm: f64,
    pub margin_y_mm: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLabelTemplate {
    pub id: i64,
    pub name: String,
    pub paper_size: String,
    /// "portrait" or "landscape".
    pub orientation: String,
    pub columns: i64,
    pub rows: i64,
    pub label_width_mm: f64,
    pub label_height_mm: f64,
    pub gap_x_mm: f64,
    pub gap_y_mm: f64,
    pub margin_x_mm: f64,
    pub margin_y_mm: f64,
    pub active: bool,
}
