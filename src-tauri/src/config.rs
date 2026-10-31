use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::AppError;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AppConfig {
    /// Path of the production database. Never points at the dev database,
    /// even while test mode is active.
    pub db_path: Option<String>,
    pub receipt_paper_size: Option<String>,
    #[serde(default)]
    pub test_mode: bool,
}

fn config_file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::Config(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Config(e.to_string()))?;
    Ok(dir.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
    let path = config_file_path(app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| AppError::Config(e.to_string()))?;
    serde_json::from_str(&data).map_err(|e| AppError::Config(e.to_string()))
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
    let path = config_file_path(app)?;
    let data =
        serde_json::to_string_pretty(config).map_err(|e| AppError::Config(e.to_string()))?;
    std::fs::write(&path, data).map_err(|e| AppError::Config(e.to_string()))
}

pub fn default_db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join("tiny-sales.db"))
}

/// The configured production database, falling back to the default location.
pub fn prod_db_path(app: &AppHandle, config: &AppConfig) -> Result<PathBuf, AppError> {
    match config.db_path.as_deref() {
        Some(p) if !p.is_empty() => Ok(PathBuf::from(p)),
        _ => default_db_path(app),
    }
}

/// The test-mode database always lives locally in the app data dir, so
/// playing around never touches a production database on e.g. a NAS.
pub fn dev_db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join("tiny-sales-dev.db"))
}

/// The database to open for the given mode.
pub fn active_db_path(app: &AppHandle, config: &AppConfig) -> Result<PathBuf, AppError> {
    if config.test_mode {
        dev_db_path(app)
    } else {
        prod_db_path(app, config)
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Config(e.to_string()))
}
