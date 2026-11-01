use sqlx::SqlitePool;
use tokio::sync::{MappedMutexGuard, Mutex, MutexGuard};

use crate::error::AppError;

pub struct AppState {
    /// The open database, or why it couldn't be opened at startup. The app
    /// starts anyway, so the window can offer an update or another database.
    pub pool: Mutex<Result<SqlitePool, String>>,
    /// Path of the database the pool is currently connected to (the dev
    /// database while test mode is active).
    pub db_path: Mutex<String>,
    pub test_mode: Mutex<bool>,
}

impl AppState {
    /// The open database, locked for the caller.
    pub async fn pool(&self) -> Result<MappedMutexGuard<'_, SqlitePool>, AppError> {
        MutexGuard::try_map(self.pool.lock().await, |pool| pool.as_mut().ok())
            .map_err(|_| AppError::Validation("Keine Datenbank geöffnet".into()))
    }

    /// Attaches `new_pool` and closes the previous database, if one was open.
    pub async fn replace_pool(&self, new_pool: SqlitePool) {
        let old = std::mem::replace(&mut *self.pool.lock().await, Ok(new_pool));
        if let Ok(old_pool) = old {
            old_pool.close().await;
        }
    }
}
