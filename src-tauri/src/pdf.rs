//! Prints what a window shows to a PDF, with its print styles, through
//! WebView2's own PDF printer - without the print dialog. Pages are A4
//! without margins; the page's CSS lays out the paper.

use tauri::WebviewWindow;

use crate::error::AppError;

#[cfg(windows)]
pub async fn print_to_pdf(window: &WebviewWindow) -> Result<Vec<u8>, AppError> {
    use std::sync::{Arc, Mutex};

    use tokio::sync::oneshot;
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Environment6, ICoreWebView2_7};
    use webview2_com::PrintToPdfCompletedHandler;
    use windows_core::{Interface, HSTRING, PCWSTR};

    // WebView2 measures paper in inches.
    const A4_WIDTH: f64 = 210.0 / 25.4;
    const A4_HEIGHT: f64 = 297.0 / 25.4;

    let path = std::env::temp_dir().join(format!("tiny-sales-{}.pdf", uuid::Uuid::new_v4()));
    let target = HSTRING::from(path.as_os_str());
    let (sender, receiver) = oneshot::channel::<Result<(), String>>();
    // Whoever finishes first - the print job or a failure to start it -
    // reports the result.
    let sender = Arc::new(Mutex::new(Some(sender)));
    let report = move |result: Result<(), String>| {
        if let Some(sender) = sender.lock().ok().and_then(|mut s| s.take()) {
            let _ = sender.send(result);
        }
    };

    window
        .with_webview(move |webview| {
            let on_done = report.clone();
            let started = (|| -> windows_core::Result<()> {
                unsafe {
                    let core = webview.controller().CoreWebView2()?.cast::<ICoreWebView2_7>()?;
                    let settings = webview.environment().cast::<ICoreWebView2Environment6>()?.CreatePrintSettings()?;
                    settings.SetPageWidth(A4_WIDTH)?;
                    settings.SetPageHeight(A4_HEIGHT)?;
                    settings.SetMarginTop(0.0)?;
                    settings.SetMarginBottom(0.0)?;
                    settings.SetMarginLeft(0.0)?;
                    settings.SetMarginRight(0.0)?;
                    settings.SetShouldPrintBackgrounds(true)?;
                    settings.SetShouldPrintHeaderAndFooter(false)?;
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, success| {
                        on_done(match result {
                            Ok(()) if success => Ok(()),
                            Ok(()) => Err("Der Druck wurde abgebrochen".into()),
                            Err(err) => Err(err.message()),
                        });
                        Ok(())
                    }));
                    core.PrintToPdf(PCWSTR(target.as_ptr()), &settings, &handler)
                }
            })();
            if let Err(err) = started {
                report(Err(err.message()));
            }
        })
        .map_err(|err| AppError::Config(format!("PDF konnte nicht erzeugt werden: {err}")))?;

    let result = receiver
        .await
        .unwrap_or_else(|_| Err("Keine Antwort vom PDF-Drucker".into()))
        .and_then(|()| std::fs::read(&path).map_err(|err| err.to_string()));
    let _ = std::fs::remove_file(&path);
    result.map_err(|err| AppError::Config(format!("PDF konnte nicht erzeugt werden: {err}")))
}

#[cfg(not(windows))]
pub async fn print_to_pdf(_window: &WebviewWindow) -> Result<Vec<u8>, AppError> {
    Err(AppError::Config("PDF-Erzeugung ist nur unter Windows verfügbar".into()))
}
