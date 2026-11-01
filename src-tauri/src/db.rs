use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// Opens the database at `db_path`, creating it if missing, and applies all
/// pending migrations. Used at startup and for the test-mode database.
pub async fn connect_and_migrate(db_path: &Path) -> Result<SqlitePool, AppError> {
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let pool = connect(db_path, true).await?;
    migrate(&pool, db_path).await?;
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
    migrate(&pool, db_path).await?;
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

/// Brings the schema up to date. Before an existing database is migrated
/// (typically the first start after an app update), a copy of it is written
/// next to it, so a failed or faulty migration never costs data. Each
/// migration runs in its own transaction.
async fn migrate(pool: &SqlitePool, db_path: &Path) -> Result<(), AppError> {
    baseline_legacy_history(pool).await?;
    let applied = applied_versions(pool).await?;
    ensure_known_schema(&applied)?;

    let pending = MIGRATOR.iter().any(|m| !applied.contains(&m.version));
    if pending && has_any_table(pool).await? {
        let backup = backup_path_beside(pool, db_path, "before-update").await?;
        sqlx::query("VACUUM INTO ?")
            .bind(backup.to_string_lossy().to_string())
            .execute(pool)
            .await?;
    }

    MIGRATOR.run(pool).await?;
    Ok(())
}

async fn applied_versions(pool: &SqlitePool) -> Result<Vec<i64>, AppError> {
    if !has_table(pool, "_sqlx_migrations").await? {
        return Ok(Vec::new());
    }
    Ok(sqlx::query_scalar("SELECT version FROM _sqlx_migrations")
        .fetch_all(pool)
        .await?)
}

/// A database already migrated by a newer version of the app (e.g. on a NAS
/// shared with a computer that was updated first) has a schema this version
/// doesn't know, so it must not be used - or migrated - by it.
fn ensure_known_schema(applied: &[i64]) -> Result<(), AppError> {
    if applied.iter().any(|version| !MIGRATOR.version_exists(*version)) {
        return Err(AppError::Validation(
            "Diese Datenbank wurde bereits mit einer neueren Version von Tiny Sales verwendet. Bitte die App aktualisieren"
                .into(),
        ));
    }
    Ok(())
}

/// e.g. `tiny-sales-before-update-20261031-153012.db` next to `tiny-sales.db`.
pub async fn backup_path_beside(pool: &SqlitePool, db_path: &Path, label: &str) -> Result<PathBuf, AppError> {
    let timestamp: String = sqlx::query_scalar("SELECT strftime('%Y%m%d-%H%M%S', 'now', 'localtime')")
        .fetch_one(pool)
        .await?;
    let stem = db_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "database".into());
    Ok(db_path.with_file_name(format!("{stem}-{label}-{timestamp}.db")))
}

/// sqlx refuses databases whose recorded migrations it doesn't know. A
/// database from before the consolidation has the same schema as the
/// initial migration, so its old history is replaced by that migration.
async fn baseline_legacy_history(pool: &SqlitePool) -> Result<(), AppError> {
    if !has_table(pool, "_sqlx_migrations").await? {
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
    let has_migrations_table = has_table(pool, "_sqlx_migrations")
        .await
        .map_err(|_| not_an_app_database())?;
    if !has_migrations_table {
        return Err(not_an_app_database());
    }
    Ok(())
}

async fn has_table(pool: &SqlitePool, name: &str) -> Result<bool, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?")
        .bind(name)
        .fetch_one(pool)
        .await?;
    Ok(count > 0)
}

/// False only for a database file that was just created.
async fn has_any_table(pool: &SqlitePool) -> Result<bool, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")
        .fetch_one(pool)
        .await?;
    Ok(count > 0)
}

fn not_an_app_database() -> AppError {
    AppError::Validation("Die gewählte Datei ist keine Datenbank dieser App".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::borrow::Cow;

    /// SHA-384 checksums of the migrations in released versions. sqlx refuses
    /// to start on a database whose recorded checksum differs, so editing a
    /// released migration would lock users out after the update. Add each
    /// new migration here when releasing it.
    const RELEASED_MIGRATIONS: &[(i64, &str)] = &[(
        1,
        "94092b17862cde8ff8c142a16a0c2fc4eb11c15466eca6b3d390b6efce71d3f4d48194683e77fe1a7284379b6fbe6f90",
    )];

    /// Data in every table of the initial schema, as a database of the first
    /// release could contain it.
    const SEED_V1: &str = "
        INSERT INTO product_group (id, name) VALUES (1, 'Shirts');
        INSERT INTO product_subgroup (id, name, product_group_id) VALUES (1, 'Kinder', 1);
        INSERT INTO article (id, code, name, product_group_id, product_subgroup_id, pattern_number, price_cents, stock)
            VALUES (1, 'A1', 'Shirt', 1, 1, 'STR-001', 2500, 3), (2, 'A2', 'Druck', 1, NULL, NULL, 500, 10);
        INSERT INTO article_component (article_id, component_article_id, price_override_cents) VALUES (1, 2, 400);
        INSERT INTO sale (id, payment_method, status, subtotal_cents, total_cents) VALUES (1, 'Cash', 'Completed', 2900, 2900);
        INSERT INTO sale_item (sale_id, article_id, quantity, list_price_cents, unit_price_cents) VALUES (1, 1, 1, 2900, 2900);
        INSERT INTO sale_return (id, sale_id, refund_method, total_refund_cents) VALUES (1, 1, 'Cash', 2900);
        INSERT INTO sale_return_item (sale_return_id, article_id, quantity, unit_price_cents, refund_cents)
            VALUES (1, 1, 1, 2900, 2900);
        INSERT INTO label_template (name, paper_size, columns, rows, label_width_mm, label_height_mm, gap_x_mm, gap_y_mm, margin_x_mm)
            VALUES ('Standard', 'A4', 3, 8, 70, 37, 0, 0, 0);
        INSERT INTO open_sale (id, number) VALUES ('00000000-0000-0000-0000-000000000001', 1);
        INSERT INTO open_sale_item (open_sale_id, article_id, position, quantity)
            VALUES ('00000000-0000-0000-0000-000000000001', 2, 0, 1);
        UPDATE company_profile SET name = 'Testladen' WHERE id = 1;
    ";

    /// A directory for test databases, removed afterwards.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// The migrations up to and including `version`: the schema of an older release.
    fn migrator_up_to(version: i64) -> Migrator {
        Migrator {
            migrations: Cow::Owned(MIGRATOR.iter().filter(|m| m.version <= version).cloned().collect()),
            ..Migrator::DEFAULT
        }
    }

    async fn row_counts(pool: &SqlitePool) -> Vec<(String, i64)> {
        let tables: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_sqlx_migrations' ORDER BY name",
        )
        .fetch_all(pool)
        .await
        .unwrap();
        let mut counts = Vec::new();
        for table in tables {
            let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{table}\""))
                .fetch_one(pool)
                .await
                .unwrap();
            counts.push((table, count));
        }
        counts
    }

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
            // The later migrations run after the baseline and write a backup first.
            let dir = TempDir::new();
            let pool = memory_pool().await;
            // A legacy database has the schema of the initial migration.
            migrator_up_to(1).run(&pool).await.unwrap();
            fake_legacy_history(&pool, LEGACY_LAST_VERSION).await;

            migrate(&pool, &dir.0.join("tiny-sales.db")).await.unwrap();

            let rows: Vec<(i64, String)> =
                sqlx::query_as("SELECT version, description FROM _sqlx_migrations ORDER BY version")
                    .fetch_all(&pool)
                    .await
                    .unwrap();
            assert_eq!(rows[0], (1, "initial schema".to_string()));
            assert_eq!(rows.len(), MIGRATOR.iter().count());
        });
    }

    #[test]
    fn too_old_legacy_database_is_refused() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let pool = memory_pool().await;
            migrate(&pool, Path::new("unused.db")).await.unwrap();
            fake_legacy_history(&pool, LEGACY_LAST_VERSION - 2).await;
            assert!(migrate(&pool, Path::new("unused.db")).await.is_err());
        });
    }

    #[test]
    fn released_migrations_are_unchanged() {
        for (version, expected) in RELEASED_MIGRATIONS {
            let migration = MIGRATOR
                .iter()
                .find(|m| m.version == *version)
                .unwrap_or_else(|| panic!("released migration {version} is missing"));
            let checksum: String = migration.checksum.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(&checksum, expected, "released migration {version} was changed - add a new migration instead");
        }
    }

    #[test]
    fn data_of_the_first_release_survives_all_migrations() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = TempDir::new();
            let db_path = dir.0.join("tiny-sales.db");
            let pool = connect(&db_path, true).await.unwrap();
            migrator_up_to(1).run(&pool).await.unwrap();
            sqlx::raw_sql(SEED_V1).execute(&pool).await.unwrap();
            let before = row_counts(&pool).await;

            migrate(&pool, &db_path).await.unwrap();

            let after = row_counts(&pool).await;
            for (table, count) in &before {
                let migrated = after.iter().find(|(t, _)| t == table).map(|(_, c)| *c);
                assert_eq!(migrated, Some(*count), "rows of table {table} were lost");
            }

            // 0002: articles attached as a component become finishings.
            // 0003: the pattern number moves to internal_number.
            let articles: Vec<(i64, Option<String>, bool)> =
                sqlx::query_as("SELECT id, internal_number, is_finishing FROM article ORDER BY id")
                    .fetch_all(&pool)
                    .await
                    .unwrap();
            assert_eq!(articles, vec![(1, Some("STR-001".into()), false), (2, None, true)]);
            let old_column: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info('article') WHERE name = 'pattern_number'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(old_column, 0, "pattern_number was not dropped");
            pool.close().await;
        });
    }

    #[test]
    fn every_earlier_schema_is_migrated_to_the_latest() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            for migration in MIGRATOR.iter() {
                let dir = TempDir::new();
                let pool = memory_pool().await;
                migrator_up_to(1).run(&pool).await.unwrap();
                sqlx::raw_sql(SEED_V1).execute(&pool).await.unwrap();
                migrator_up_to(migration.version).run(&pool).await.unwrap();

                migrate(&pool, &dir.0.join("tiny-sales.db"))
                    .await
                    .unwrap_or_else(|err| panic!("from version {}: {err}", migration.version));
            }
        });
    }

    #[test]
    fn database_of_a_newer_app_is_refused() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let pool = memory_pool().await;
            migrate(&pool, Path::new("unused.db")).await.unwrap();
            sqlx::query(
                "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES (9999, 'future', 1, X'00', 0)",
            )
            .execute(&pool)
            .await
            .unwrap();

            let err = migrate(&pool, Path::new("unused.db")).await.unwrap_err();
            assert!(err.to_string().contains("neueren Version"), "{err}");
        });
    }

    #[test]
    fn existing_database_is_backed_up_before_migrating() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = TempDir::new();
            let db_path = dir.0.join("tiny-sales.db");
            let pool = connect(&db_path, true).await.unwrap();
            // A database of the first release, with its data.
            migrator_up_to(1).run(&pool).await.unwrap();
            sqlx::raw_sql(SEED_V1).execute(&pool).await.unwrap();
            // Pretend the migrations are pending; re-running them fails
            // because the tables exist, like a faulty migration would.
            sqlx::query("DELETE FROM _sqlx_migrations").execute(&pool).await.unwrap();

            assert!(migrate(&pool, &db_path).await.is_err());
            pool.close().await;

            let backup = std::fs::read_dir(&dir.0)
                .unwrap()
                .map(|entry| entry.unwrap().path())
                .find(|path| path.to_string_lossy().contains("-before-update-"))
                .expect("no backup was written");
            let backup_pool = connect(&backup, false).await.unwrap();
            let groups: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM product_group")
                .fetch_one(&backup_pool)
                .await
                .unwrap();
            assert_eq!(groups, 1);
            backup_pool.close().await;
        });
    }

    #[test]
    fn new_database_is_not_backed_up() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = TempDir::new();
            let pool = connect_and_migrate(&dir.0.join("tiny-sales.db")).await.unwrap();
            pool.close().await;
            assert_eq!(std::fs::read_dir(&dir.0).unwrap().count(), 1);
        });
    }
}
