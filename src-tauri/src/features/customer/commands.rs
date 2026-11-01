use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{Customer, NewCustomer, UpdateCustomer};
use super::service::CustomerService;

#[tauri::command]
pub async fn list_customers(state: State<'_, AppState>) -> Result<Vec<Customer>, AppError> {
    let pool = state.pool().await?;
    CustomerService::list(&pool).await
}

#[tauri::command]
pub async fn create_customer(state: State<'_, AppState>, input: NewCustomer) -> Result<Customer, AppError> {
    let pool = state.pool().await?;
    CustomerService::create(&pool, input).await
}

#[tauri::command]
pub async fn update_customer(state: State<'_, AppState>, input: UpdateCustomer) -> Result<Customer, AppError> {
    let pool = state.pool().await?;
    CustomerService::update(&pool, input).await
}

#[tauri::command]
pub async fn deactivate_customer(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pool = state.pool().await?;
    CustomerService::deactivate(&pool, id).await
}
