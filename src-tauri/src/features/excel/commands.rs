use std::path::Path;

use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{ImportPreview, ImportResult};
use super::{article, customer};

#[tauri::command]
pub async fn export_articles(state: State<'_, AppState>, path: String) -> Result<(), AppError> {
    let pool = state.pool().await?;
    article::export(&pool, Path::new(&path)).await
}

#[tauri::command]
pub async fn preview_article_import(state: State<'_, AppState>, path: String) -> Result<ImportPreview, AppError> {
    let pool = state.pool().await?;
    article::preview(&pool, Path::new(&path)).await
}

#[tauri::command]
pub async fn apply_article_import(state: State<'_, AppState>, path: String) -> Result<ImportResult, AppError> {
    let pool = state.pool().await?;
    article::apply(&pool, Path::new(&path)).await
}

#[tauri::command]
pub async fn export_customers(state: State<'_, AppState>, path: String) -> Result<(), AppError> {
    let pool = state.pool().await?;
    customer::export(&pool, Path::new(&path)).await
}

#[tauri::command]
pub async fn preview_customer_import(state: State<'_, AppState>, path: String) -> Result<ImportPreview, AppError> {
    let pool = state.pool().await?;
    customer::preview(&pool, Path::new(&path)).await
}

#[tauri::command]
pub async fn apply_customer_import(state: State<'_, AppState>, path: String) -> Result<ImportResult, AppError> {
    let pool = state.pool().await?;
    customer::apply(&pool, Path::new(&path)).await
}
