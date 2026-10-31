use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::CompanyProfile;
use super::service::CompanyProfileService;

#[tauri::command]
pub async fn get_company_profile(state: State<'_, AppState>) -> Result<CompanyProfile, AppError> {
    let pool = state.pool.lock().await;
    CompanyProfileService::get(&pool).await
}

#[tauri::command]
pub async fn save_company_profile(
    state: State<'_, AppState>,
    input: CompanyProfile,
) -> Result<CompanyProfile, AppError> {
    let pool = state.pool.lock().await;
    CompanyProfileService::save(&pool, input).await
}
