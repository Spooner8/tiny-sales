use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{OpenSale, SaveOpenSale};
use super::service::OpenSaleService;

#[tauri::command]
pub async fn list_open_sales(state: State<'_, AppState>) -> Result<Vec<OpenSale>, AppError> {
    let pool = state.pool.lock().await;
    OpenSaleService::list(&pool).await
}

#[tauri::command]
pub async fn save_open_sale(state: State<'_, AppState>, input: SaveOpenSale) -> Result<(), AppError> {
    let pool = state.pool.lock().await;
    OpenSaleService::save(&pool, input).await
}

#[tauri::command]
pub async fn delete_open_sale(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let pool = state.pool.lock().await;
    OpenSaleService::delete(&pool, &id).await
}
