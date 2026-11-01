use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{Article, NewArticle, UpdateArticle};
use super::service::ArticleService;

#[tauri::command]
pub async fn list_articles(state: State<'_, AppState>) -> Result<Vec<Article>, AppError> {
    let pool = state.pool().await?;
    ArticleService::list(&pool).await
}

#[tauri::command]
pub async fn create_article(
    state: State<'_, AppState>,
    input: NewArticle,
) -> Result<Article, AppError> {
    let pool = state.pool().await?;
    ArticleService::create(&pool, input).await
}

#[tauri::command]
pub async fn update_article(
    state: State<'_, AppState>,
    input: UpdateArticle,
) -> Result<Article, AppError> {
    let pool = state.pool().await?;
    ArticleService::update(&pool, input).await
}

#[tauri::command]
pub async fn deactivate_article(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pool = state.pool().await?;
    ArticleService::deactivate(&pool, id).await
}
