use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;

use crate::error::AppError;

/// Opens the database at `db_path`, creating it if missing, and applies all
/// pending migrations. Used at startup and for the test-mode database.
pub async fn connect_and_migrate(db_path: &Path) -> Result<SqlitePool, AppError> {
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let pool = connect(db_path, true).await?;
    migrate(&pool).await?;
    Ok(pool)
}

/// Opens an existing database of this app (e.g. an older copy) without ever
/// creating or overwriting a file. Older schemas are migrated forward.
pub async fn open_existing(db_path: &Path) -> Result<SqlitePool, AppError> {
    if !db_path.is_file() {
        return Err(AppError::Validation(format!(
            "Datei nicht gefunden: {}",
            db_path.display()
        )));
    }
    let pool = connect(db_path, false).await?;
    if let Err(err) = ensure_app_database(&pool).await {
        pool.close().await;
        return Err(err);
    }
    migrate(&pool).await?;
    Ok(pool)
}

/// Creates a fresh, empty database. Refuses to touch an existing file.
pub async fn create_new(db_path: &Path) -> Result<SqlitePool, AppError> {
    if db_path.exists() {
        return Err(AppError::Validation(format!(
            "Die Datei existiert bereits: {}. Bestehende Datenbanken bitte über \"Datenbank öffnen\" wählen.",
            db_path.display()
        )));
    }
    connect_and_migrate(db_path).await
}

/// Checks that `db_path` is a database created by this app, without
/// modifying it (opened read-only).
pub async fn validate_app_database_file(db_path: &Path) -> Result<(), AppError> {
    if !db_path.is_file() {
        return Err(AppError::Validation(format!(
            "Datei nicht gefunden: {}",
            db_path.display()
        )));
    }
    let options = SqliteConnectOptions::new().filename(db_path).read_only(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|_| not_an_app_database())?;
    let result = ensure_app_database(&pool).await;
    pool.close().await;
    result
}

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Description sqlx stored for the first migration of databases created
/// before the schema history was consolidated into `0001_initial_schema`.
const LEGACY_FIRST_MIGRATION: &str = "init";
/// Last migration of that old history; its schema equals the initial schema.
const LEGACY_LAST_VERSION: i64 = 15;

async fn migrate(pool: &SqlitePool) -> Result<(), AppError> {
    baseline_legacy_history(pool).await?;
    MIGRATOR.run(pool).await?;
    Ok(())
}

/// sqlx refuses databases whose recorded migrations it doesn't know. A
/// database from before the consolidation has the same schema as the
/// initial migration, so its old history is replaced by that migration.
async fn baseline_legacy_history(pool: &SqlitePool) -> Result<(), AppError> {
    let has_history: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(pool)
    .await?;
    if has_history == 0 {
        return Ok(());
    }
    let first: Option<String> = sqlx::query_scalar("SELECT description FROM _sqlx_migrations WHERE version = 1")
        .fetch_optional(pool)
        .await?;
    if first.as_deref() != Some(LEGACY_FIRST_MIGRATION) {
        return Ok(());
    }
    let latest: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations WHERE success = 1")
        .fetch_one(pool)
        .await?;
    if latest < LEGACY_LAST_VERSION {
        return Err(AppError::Validation(
            "Diese Datenbank stammt von einer zu alten Version der App und kann nicht übernommen werden".into(),
        ));
    }

    let initial = MIGRATOR
        .iter()
        .find(|m| m.version == 1)
        .ok_or_else(|| AppError::Config("Initiale Migration fehlt".into()))?;
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM _sqlx_migrations").execute(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES (?, ?, 1, ?, 0)",
    )
    .bind(initial.version)
    .bind(initial.description.as_ref())
    .bind(initial.checksum.as_ref())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn connect(db_path: &Path, create_if_missing: bool) -> Result<SqlitePool, AppError> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(create_if_missing);

    // A single connection is enough: single-user desktop app, avoids
    // lock conflicts in case the db path later points at a NAS.
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;
    Ok(pool)
}

/// Every database this app created has sqlx's migration bookkeeping table;
/// anything else (a foreign SQLite file, a non-database file) is rejected so
/// it never gets our schema migrated into it.
async fn ensure_app_database(pool: &SqlitePool) -> Result<(), AppError> {
    let has_migrations_table: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(pool)
    .await
    .map_err(|_| not_an_app_database())?;
    if has_migrations_table == 0 {
        return Err(not_an_app_database());
    }
    Ok(())
}

fn not_an_app_database() -> AppError {
    AppError::Validation("Die gewählte Datei ist keine Datenbank dieser App".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn memory_pool() -> SqlitePool {
        SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap()
    }

    /// Rewrites the history of a migrated database to look like one from
    /// before the consolidation, up to `latest`.
    async fn fake_legacy_history(pool: &SqlitePool, latest: i64) {
        sqlx::query("DELETE FROM _sqlx_migrations").execute(pool).await.unwrap();
        for version in 1..=latest {
            let description = if version == 1 { "init".to_string() } else { format!("legacy {version}") };
            sqlx::query(
                "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES (?, ?, 1, X'00', 0)",
            )
            .bind(version)
            .bind(description)
            .execute(pool)
            .await
            .unwrap();
        }
    }

    #[test]
    fn legacy_database_is_baselined() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let pool = memory_pool().await;
            migrate(&pool).await.unwrap();
            fake_legacy_history(&pool, LEGACY_LAST_VERSION).await;

            migrate(&pool).await.unwrap();

            let rows: Vec<(i64, String)> = sqlx::query_as("SELECT version, description FROM _sqlx_migrations")
                .fetch_all(&pool)
                .await
                .unwrap();
            assert_eq!(rows, vec![(1, "initial schema".to_string())]);
        });
    }

    #[test]
    fn too_old_legacy_database_is_refused() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let pool = memory_pool().await;
            migrate(&pool).await.unwrap();
            fake_legacy_history(&pool, LEGACY_LAST_VERSION - 2).await;
            assert!(migrate(&pool).await.is_err());
        });
    }
}
