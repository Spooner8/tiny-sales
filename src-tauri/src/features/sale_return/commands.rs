use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{NewSaleReturn, SaleReturnWithItems};
use super::service::SaleReturnService;

#[tauri::command]
pub async fn create_sale_return(
    state: State<'_, AppState>,
    input: NewSaleReturn,
) -> Result<SaleReturnWithItems, AppError> {
    let pool = state.pool.lock().await;
    SaleReturnService::create(&pool, input).await
}

#[tauri::command]
pub async fn list_sale_returns(
    state: State<'_, AppState>,
    sale_id: i64,
) -> Result<Vec<SaleReturnWithItems>, AppError> {
    let pool = state.pool.lock().await;
    SaleReturnService::list_for_sale(&pool, sale_id).await
}
