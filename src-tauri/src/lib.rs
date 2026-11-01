mod config;
mod db;
mod error;
mod features;
mod money;
mod pdf;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = tauri::async_runtime::block_on(async move {
                let mut cfg = config::load_config(&app_handle).unwrap_or_default();
                let prod_path = config::prod_db_path(&app_handle, &cfg)
                    .expect("could not determine default db path");
                let db_path = config::active_db_path(&app_handle, &cfg)
                    .expect("could not determine db path");

                // Without a database the window still opens and shows why,
                // so an update or another database can be chosen there.
                let pool = db::connect_and_migrate(&db_path).await.map_err(|err| err.to_string());

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
            features::settings::commands::get_database_error,
            features::settings::commands::retry_database,
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
            features::customer::commands::list_customers,
            features::customer::commands::create_customer,
            features::customer::commands::update_customer,
            features::customer::commands::deactivate_customer,
            features::customer_order::commands::list_customer_orders,
            features::customer_order::commands::get_customer_order,
            features::customer_order::commands::save_customer_order,
            features::customer_order::commands::set_customer_order_status,
            features::customer_order::commands::delete_customer_order,
            features::customer_order::commands::complete_customer_order,
            features::invoice::commands::get_invoice,
            features::invoice::commands::store_invoice_pdf,
            features::invoice::commands::open_invoice_pdf,
            features::invoice::commands::save_invoice_pdf,
            features::invoice::commands::set_invoice_paid_on,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
