use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;
use crate::{config, db};

#[tauri::command]
pub async fn get_db_path(state: State<'_, AppState>) -> Result<String, AppError> {
    Ok(state.db_path.lock().await.clone())
}

/// Why the database couldn't be opened at startup; `None` while one is open.
#[tauri::command]
pub async fn get_database_error(state: State<'_, AppState>) -> Result<Option<String>, AppError> {
    Ok(state.pool.lock().await.as_ref().err().cloned())
}

/// Opens the configured database again, e.g. once the NAS it lives on is
/// reachable again after it couldn't be opened at startup.
#[tauri::command]
pub async fn retry_database(app: AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    let cfg = config::load_config(&app)?;
    let path = config::active_db_path(&app, &cfg)?;
    let new_pool = db::connect_and_migrate(&path).await?;
    state.replace_pool(new_pool).await;
    *state.db_path.lock().await = path.to_string_lossy().to_string();
    Ok(())
}

/// Switches the production database to an existing file (e.g. an older
/// copy). The file is used as-is - never created or overwritten.
#[tauri::command]
pub async fn open_database(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), AppError> {
    ensure_not_test_mode(&state).await?;
    let new_pool = db::open_existing(Path::new(&path)).await?;
    switch_production_database(&app, &state, new_pool, path).await
}

/// Creates a new, empty production database at `path` and switches to it.
#[tauri::command]
pub async fn create_database(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), AppError> {
    ensure_not_test_mode(&state).await?;
    let new_pool = db::create_new(Path::new(&path)).await?;
    switch_production_database(&app, &state, new_pool, path).await
}

/// The configured path is the production database; switching it while the
/// dev database is attached would silently mix the two up.
async fn ensure_not_test_mode(state: &State<'_, AppState>) -> Result<(), AppError> {
    if *state.test_mode.lock().await {
        return Err(AppError::Validation(
            "Die Datenbank kann im Test-Modus nicht gewechselt werden".into(),
        ));
    }
    Ok(())
}

async fn switch_production_database(
    app: &AppHandle,
    state: &State<'_, AppState>,
    new_pool: SqlitePool,
    path: String,
) -> Result<(), AppError> {
    state.replace_pool(new_pool).await;
    *state.db_path.lock().await = path.clone();

    let mut cfg = config::load_config(app)?;
    cfg.db_path = Some(path);
    config::save_config(app, &cfg)
}

#[tauri::command]
pub async fn get_test_mode(state: State<'_, AppState>) -> Result<bool, AppError> {
    Ok(*state.test_mode.lock().await)
}

/// Switches between the production database and the local dev database
/// (created and migrated on first use).
#[tauri::command]
pub async fn set_test_mode(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), AppError> {
    // Held for the whole switch so two toggles can't interleave.
    let mut test_mode = state.test_mode.lock().await;
    if *test_mode == enabled {
        return Ok(());
    }

    let mut cfg = config::load_config(&app)?;
    cfg.test_mode = enabled;
    let new_path = config::active_db_path(&app, &cfg)?;
    let new_pool = db::connect_and_migrate(&new_path).await?;

    state.replace_pool(new_pool).await;
    *state.db_path.lock().await = new_path.to_string_lossy().to_string();
    *test_mode = enabled;

    config::save_config(&app, &cfg)
}

#[tauri::command]
pub async fn backup_database(state: State<'_, AppState>, destination: String) -> Result<(), AppError> {
    let pool = state.pool().await?;
    sqlx::query("VACUUM INTO ?")
        .bind(destination)
        .execute(&*pool)
        .await?;
    Ok(())
}

/// Replaces the contents of the active database with a backup (the data is
/// not merged). A safety copy of the current data is written next to the
/// database first; its path is returned. If anything fails after the
/// current database was closed, the safety copy is put back.
#[tauri::command]
pub async fn restore_database(state: State<'_, AppState>, source: String) -> Result<String, AppError> {
    let db_path = PathBuf::from(state.db_path.lock().await.clone());
    let source_path = PathBuf::from(&source);
    if is_same_file(&source_path, &db_path) {
        return Err(AppError::Validation(
            "Das gewählte Backup ist die aktuell verwendete Datenbank".into(),
        ));
    }
    db::validate_app_database_file(&source_path).await?;

    // Held for the whole swap so no other command runs against a closed pool.
    let mut pool = state.pool().await?;

    let safety_copy = db::backup_path_beside(&pool, &db_path, "before-restore").await?;
    sqlx::query("VACUUM INTO ?")
        .bind(safety_copy.to_string_lossy().to_string())
        .execute(&*pool)
        .await?;
    pool.close().await;

    let restored = match std::fs::copy(&source_path, &db_path) {
        Ok(_) => db::connect_and_migrate(&db_path).await,
        Err(e) => Err(AppError::Config(e.to_string())),
    };
    match restored {
        Ok(new_pool) => {
            *pool = new_pool;
            Ok(safety_copy.to_string_lossy().to_string())
        }
        Err(err) => {
            std::fs::copy(&safety_copy, &db_path).map_err(|e| AppError::Config(e.to_string()))?;
            *pool = db::connect_and_migrate(&db_path).await?;
            Err(err)
        }
    }
}

fn is_same_file(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

#[tauri::command]
pub async fn get_receipt_paper_size(app: AppHandle) -> Result<String, AppError> {
    let cfg = config::load_config(&app)?;
    Ok(cfg.receipt_paper_size.unwrap_or_else(|| "A4".to_string()))
}

#[tauri::command]
pub async fn set_receipt_paper_size(app: AppHandle, size: String) -> Result<(), AppError> {
    let mut cfg = config::load_config(&app)?;
    cfg.receipt_paper_size = Some(size);
    config::save_config(&app, &cfg)
}
