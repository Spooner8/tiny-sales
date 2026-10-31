use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::model::{LabelTemplate, NewLabelTemplate, UpdateLabelTemplate};
use super::service::LabelTemplateService;

#[tauri::command]
pub async fn list_label_templates(state: State<'_, AppState>) -> Result<Vec<LabelTemplate>, AppError> {
    let pool = state.pool.lock().await;
    LabelTemplateService::list(&pool).await
}

#[tauri::command]
pub async fn create_label_template(
    state: State<'_, AppState>,
    input: NewLabelTemplate,
) -> Result<LabelTemplate, AppError> {
    let pool = state.pool.lock().await;
    LabelTemplateService::create(&pool, input).await
}

#[tauri::command]
pub async fn update_label_template(
    state: State<'_, AppState>,
    input: UpdateLabelTemplate,
) -> Result<LabelTemplate, AppError> {
    let pool = state.pool.lock().await;
    LabelTemplateService::update(&pool, input).await
}

#[tauri::command]
pub async fn deactivate_label_template(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pool = state.pool.lock().await;
    LabelTemplateService::deactivate(&pool, id).await
}
