use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{NewProductSubgroup, ProductSubgroup, UpdateProductSubgroup};
use super::service::ProductSubgroupService;

#[tauri::command]
pub async fn list_product_subgroups(state: State<'_, AppState>) -> Result<Vec<ProductSubgroup>, AppError> {
    let pool = state.pool.lock().await;
    ProductSubgroupService::list(&pool).await
}

#[tauri::command]
pub async fn create_product_subgroup(
    state: State<'_, AppState>,
    input: NewProductSubgroup,
) -> Result<ProductSubgroup, AppError> {
    let pool = state.pool.lock().await;
    ProductSubgroupService::create(&pool, input).await
}

#[tauri::command]
pub async fn update_product_subgroup(
    state: State<'_, AppState>,
    input: UpdateProductSubgroup,
) -> Result<ProductSubgroup, AppError> {
    let pool = state.pool.lock().await;
    ProductSubgroupService::update(&pool, input).await
}

#[tauri::command]
pub async fn deactivate_product_subgroup(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pool = state.pool.lock().await;
    ProductSubgroupService::deactivate(&pool, id).await
}
