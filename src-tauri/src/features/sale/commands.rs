use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{ArticleRevenue, DailyRevenue, NewSale, ProductGroupRevenue, SaleListEntry, SaleWithItems};
use super::service::SaleService;

#[tauri::command]
pub async fn create_sale(state: State<'_, AppState>, input: NewSale) -> Result<SaleWithItems, AppError> {
    let pool = state.pool().await?;
    SaleService::create(&pool, input).await
}

#[tauri::command]
pub async fn list_sales(state: State<'_, AppState>, from: String, to: String) -> Result<Vec<SaleListEntry>, AppError> {
    let pool = state.pool().await?;
    SaleService::list(&pool, &from, &to).await
}

#[tauri::command]
pub async fn get_sale(state: State<'_, AppState>, id: i64) -> Result<SaleWithItems, AppError> {
    let pool = state.pool().await?;
    SaleService::get(&pool, id).await
}

#[tauri::command]
pub async fn set_sale_customer(
    state: State<'_, AppState>,
    id: i64,
    customer_id: Option<i64>,
) -> Result<SaleWithItems, AppError> {
    let pool = state.pool().await?;
    SaleService::set_customer(&pool, id, customer_id).await
}

#[tauri::command]
pub async fn get_revenue_by_day(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<Vec<DailyRevenue>, AppError> {
    let pool = state.pool().await?;
    SaleService::revenue_by_day(&pool, &from, &to).await
}

#[tauri::command]
pub async fn get_revenue_by_product_group(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<Vec<ProductGroupRevenue>, AppError> {
    let pool = state.pool().await?;
    SaleService::revenue_by_product_group(&pool, &from, &to).await
}

#[tauri::command]
pub async fn get_revenue_by_article(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<Vec<ArticleRevenue>, AppError> {
    let pool = state.pool().await?;
    SaleService::revenue_by_article(&pool, &from, &to).await
}
