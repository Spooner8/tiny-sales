use serde::Serialize;

/// A problem in one row of an imported file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRowError {
    /// Row number as Excel shows it.
    pub row: u32,
    pub message: String,
}

/// What importing one row will do.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportChange {
    pub row: u32,
    /// What the row is about, e.g. the article's number and name.
    pub label: String,
    /// The changed values, e.g. "Preis: 25.00 → 27.00"; empty for new rows.
    pub changes: Vec<String>,
}

/// What an import would do, shown before anything is written.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub created: Vec<ImportChange>,
    pub updated: Vec<ImportChange>,
    pub unchanged: usize,
    /// Any error keeps the whole file from being imported.
    pub errors: Vec<ImportRowError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub created: usize,
    pub updated: usize,
}
