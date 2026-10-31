use sqlx::SqlitePool;
use tokio::sync::Mutex;

pub struct AppState {
    pub pool: Mutex<SqlitePool>,
    /// Path of the database the pool is currently connected to (the dev
    /// database while test mode is active).
    pub db_path: Mutex<String>,
    pub test_mode: Mutex<bool>,
}
