use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{CompleteCustomerOrder, CompletedCustomerOrder, CustomerOrder, SaveCustomerOrder};
use super::service::CustomerOrderService;

#[tauri::command]
pub async fn list_customer_orders(state: State<'_, AppState>) -> Result<Vec<CustomerOrder>, AppError> {
    let pool = state.pool().await?;
    CustomerOrderService::list(&pool).await
}

#[tauri::command]
pub async fn get_customer_order(state: State<'_, AppState>, id: i64) -> Result<CustomerOrder, AppError> {
    let pool = state.pool().await?;
    CustomerOrderService::get(&pool, id).await
}

#[tauri::command]
pub async fn save_customer_order(
    state: State<'_, AppState>,
    input: SaveCustomerOrder,
) -> Result<CustomerOrder, AppError> {
    let pool = state.pool().await?;
    CustomerOrderService::save(&pool, input).await
}

#[tauri::command]
pub async fn set_customer_order_status(
    state: State<'_, AppState>,
    id: i64,
    status: String,
) -> Result<CustomerOrder, AppError> {
    let pool = state.pool().await?;
    CustomerOrderService::set_status(&pool, id, status).await
}

#[tauri::command]
pub async fn delete_customer_order(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pool = state.pool().await?;
    CustomerOrderService::delete(&pool, id).await
}

#[tauri::command]
pub async fn complete_customer_order(
    state: State<'_, AppState>,
    input: CompleteCustomerOrder,
) -> Result<CompletedCustomerOrder, AppError> {
    let pool = state.pool().await?;
    CustomerOrderService::complete(&pool, input).await
}
