use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Datenbankfehler: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Migrationsfehler: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("Konfigurationsfehler: {0}")]
    Config(String),
    #[error("Nicht gefunden: {0}")]
    NotFound(String),
    #[error("Ungueltige Eingabe: {0}")]
    Validation(String),
}

// Tauri serializes command errors as JSON to the frontend - for that,
// AppError needs to implement Serialize. We only pass along the error
// message, no internal details (e.g. stack traces).
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
