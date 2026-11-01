use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;
use crate::pdf;
use crate::state::AppState;

use super::model::InvoiceDetail;
use super::service::InvoiceService;

#[tauri::command]
pub async fn get_invoice(state: State<'_, AppState>, id: i64) -> Result<InvoiceDetail, AppError> {
    let pool = state.pool().await?;
    InvoiceService::get(&pool, id).await
}

/// Prints the invoice the calling window currently shows to PDF and stores
/// it, unless a PDF was stored before.
#[tauri::command]
pub async fn store_invoice_pdf(window: WebviewWindow, state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    // The database stays unlocked while printing, which takes a moment.
    if InvoiceService::has_pdf(&*state.pool().await?, id).await? {
        return Ok(());
    }
    let pdf = pdf::print_to_pdf(&window).await?;
    let pool = state.pool().await?;
    InvoiceService::store_pdf(&pool, id, &pdf).await
}

/// Opens the stored PDF in the default PDF viewer.
#[tauri::command]
pub async fn open_invoice_pdf(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let pdf = InvoiceService::pdf(&*state.pool().await?, id).await?;
    let dir = std::env::temp_dir().join("tiny-sales");
    let path = dir.join(format!("Rechnung-{id}.pdf"));
    std::fs::create_dir_all(&dir)
        .and_then(|()| std::fs::write(&path, pdf))
        .map_err(|err| AppError::Config(format!("PDF konnte nicht geschrieben werden: {err}")))?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|err| AppError::Config(format!("PDF konnte nicht geöffnet werden: {err}")))
}

/// Writes the stored PDF to `path`, chosen by the user.
#[tauri::command]
pub async fn save_invoice_pdf(state: State<'_, AppState>, id: i64, path: String) -> Result<(), AppError> {
    let pdf = InvoiceService::pdf(&*state.pool().await?, id).await?;
    std::fs::write(&path, pdf).map_err(|err| AppError::Config(format!("PDF konnte nicht gespeichert werden: {err}")))
}

#[tauri::command]
pub async fn set_invoice_paid_on(
    state: State<'_, AppState>,
    id: i64,
    paid_on: Option<String>,
) -> Result<(), AppError> {
    let pool = state.pool().await?;
    InvoiceService::set_paid_on(&pool, id, paid_on).await
}
