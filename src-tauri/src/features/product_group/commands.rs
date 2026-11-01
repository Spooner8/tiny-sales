use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{NewProductGroup, ProductGroup, UpdateProductGroup};
use super::service::ProductGroupService;

/// Thin Tauri command layer: takes input from the frontend, delegates to
/// the service, translates nothing itself (no business logic here).
#[tauri::command]
pub async fn list_product_groups(state: State<'_, AppState>) -> Result<Vec<ProductGroup>, AppError> {
    let pool = state.pool().await?;
    ProductGroupService::list(&pool).await
}

#[tauri::command]
pub async fn create_product_group(
    state: State<'_, AppState>,
    input: NewProductGroup,
) -> Result<ProductGroup, AppError> {
    let pool = state.pool().await?;
    ProductGroupService::create(&pool, input).await
}

#[tauri::command]
pub async fn update_product_group(
    state: State<'_, AppState>,
    input: UpdateProductGroup,
) -> Result<ProductGroup, AppError> {
    let pool = state.pool().await?;
    ProductGroupService::update(&pool, input).await
}

#[tauri::command]
pub async fn deactivate_product_group(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pool = state.pool().await?;
    ProductGroupService::deactivate(&pool, id).await
}
