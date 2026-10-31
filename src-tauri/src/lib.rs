mod config;
mod db;
mod error;
mod features;
mod money;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = tauri::async_runtime::block_on(async move {
                let mut cfg = config::load_config(&app_handle).unwrap_or_default();
                let prod_path = config::prod_db_path(&app_handle, &cfg)
                    .expect("could not determine default db path");
                let db_path = config::active_db_path(&app_handle, &cfg)
                    .expect("could not determine db path");

                let pool = db::connect_and_migrate(&db_path)
                    .await
                    .expect("database could not be opened/migrated");

                cfg.db_path = Some(prod_path.to_string_lossy().to_string());
                let _ = config::save_config(&app_handle, &cfg);

                AppState {
                    pool: tokio::sync::Mutex::new(pool),
                    db_path: tokio::sync::Mutex::new(db_path.to_string_lossy().to_string()),
                    test_mode: tokio::sync::Mutex::new(cfg.test_mode),
                }
            });

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            features::settings::commands::get_db_path,
            features::settings::commands::open_database,
            features::settings::commands::create_database,
            features::settings::commands::backup_database,
            features::settings::commands::restore_database,
            features::settings::commands::get_test_mode,
            features::settings::commands::set_test_mode,
            features::settings::commands::get_receipt_paper_size,
            features::settings::commands::set_receipt_paper_size,
            features::company_profile::commands::get_company_profile,
            features::company_profile::commands::save_company_profile,
            features::product_group::commands::list_product_groups,
            features::product_group::commands::create_product_group,
            features::product_group::commands::update_product_group,
            features::product_group::commands::deactivate_product_group,
            features::article::commands::list_articles,
            features::article::commands::create_article,
            features::article::commands::update_article,
            features::article::commands::deactivate_article,
            features::product_subgroup::commands::list_product_subgroups,
            features::product_subgroup::commands::create_product_subgroup,
            features::product_subgroup::commands::update_product_subgroup,
            features::product_subgroup::commands::deactivate_product_subgroup,
            features::open_sale::commands::list_open_sales,
            features::open_sale::commands::save_open_sale,
            features::open_sale::commands::delete_open_sale,
            features::sale::commands::create_sale,
            features::sale::commands::list_sales,
            features::sale::commands::get_sale,
            features::sale::commands::get_revenue_by_day,
            features::sale::commands::get_revenue_by_product_group,
            features::sale::commands::get_revenue_by_article,
            features::sale_return::commands::create_sale_return,
            features::sale_return::commands::list_sale_returns,
            features::label_template::commands::list_label_templates,
            features::label_template::commands::create_label_template,
            features::label_template::commands::update_label_template,
            features::label_template::commands::deactivate_label_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
