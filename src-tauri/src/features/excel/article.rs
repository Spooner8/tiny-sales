//! Export and import of articles. A row is one article you can sell, with
//! its own number and stock. Its finishings aren't part of the file and stay
//! as they are.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use rust_xlsxwriter::{DataValidation, Format, Formula, Workbook, XlsxError};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::article::model::{Article, NewArticle, UpdateArticle};
use crate::features::article::repository::ArticleRepository;
use crate::features::article::service::random_code;
use crate::features::invoice::qr_bill::format_amount;
use crate::features::product_group::model::ProductGroup;
use crate::features::product_group::repository::ProductGroupRepository;
use crate::features::product_subgroup::model::ProductSubgroup;
use crate::features::product_subgroup::repository::ProductSubgroupRepository;

use super::model::{ImportChange, ImportPreview, ImportResult, ImportRowError};
use super::workbook::{self, flag_text, SheetRow};

const SHEET: &str = "Artikel";
const LEGEND_SHEET: &str = "Warenuntergruppen";

const CODE: &str = "Art-Nr.";
const NAME: &str = "Name";
const SUBGROUP_ID: &str = "Warenuntergruppe-ID";
const SUBGROUP_NAME: &str = "Warenuntergruppe (automatisch)";
const INTERNAL_NUMBER: &str = "Interne Nr.";
const DESCRIPTION: &str = "Beschreibung";
const PRICE: &str = "Preis (CHF)";
const STOCK: &str = "Bestand";
const DISCOUNT: &str = "Aktions-Rabatt (%)";
const ACTIVE: &str = "Aktiv";
const DISCONTINUED: &str = "Auslaufend";
const FINISHING: &str = "Veredelung";

const IMPORT_HEADERS: [&str; 11] = [
    CODE,
    NAME,
    SUBGROUP_ID,
    INTERNAL_NUMBER,
    DESCRIPTION,
    PRICE,
    STOCK,
    DISCOUNT,
    ACTIVE,
    DISCONTINUED,
    FINISHING,
];

/// Rows prepared with dropdowns and the automatic name, for adding articles.
const ROWS_FOR_NEW_ARTICLES: u32 = 1000;

const NOTES: [&str; 9] = [
    "Artikel importieren und anpassen",
    "Zeile ohne Art-Nr.: ein neuer Artikel, die Nummer vergibt das Programm. Zeile mit Art-Nr.: dieser Artikel wird angepasst.",
    "Pflichtfelder (rosa): Name, Warenuntergruppe-ID und Preis. Die Warengruppe ergibt sich aus der Untergruppe.",
    "Die IDs stehen im Tabellenblatt «Warenuntergruppen». Die Spalte «Warenuntergruppe (automatisch)» dient nur zur Kontrolle und wird nicht importiert.",
    "Der Preis ist der Grundpreis ohne Veredelungen und ohne Aktion. Veredelungen werden hier nicht bearbeitet und bleiben unverändert.",
    "Leeres Feld: Bestand und Aktions-Rabatt zählen als 0, Aktiv als Ja, Auslaufend und Veredelung als Nein, die übrigen Angaben werden geleert.",
    "Der Bestand wird auf den Wert in der Datei gesetzt. Verkäufe seit dem Export sind darin nicht enthalten: Exportieren Sie frisch, bevor Sie den Bestand anpassen.",
    "Artikel werden nie gelöscht. Eine fehlende Zeile lässt den Artikel unverändert; zum Ausblenden «Aktiv» auf Nein setzen.",
    "Vor dem Übernehmen zeigt das Programm alle Änderungen. Enthält die Datei einen Fehler, wird nichts übernommen.",
];

pub async fn export(pool: &SqlitePool, path: &Path) -> Result<(), AppError> {
    let articles = ArticleRepository::list(pool).await?;
    let groups = ProductGroupRepository::list(pool).await?;
    let subgroups = ProductSubgroupRepository::list(pool).await?;
    let workbook = build_workbook(&articles, &groups, &subgroups).map_err(workbook::build_error)?;
    workbook::save(workbook, path)
}

fn build_workbook(
    articles: &[Article],
    groups: &[ProductGroup],
    subgroups: &[ProductSubgroup],
) -> Result<Workbook, XlsxError> {
    let mut workbook = Workbook::new();
    let group_names: HashMap<i64, &str> = groups.iter().map(|g| (g.id, g.name.as_str())).collect();
    let subgroup_label = |id: i64| {
        subgroups.iter().find(|s| s.id == id).map_or(String::new(), |s| {
            format!("{} / {}", group_names.get(&s.product_group_id).copied().unwrap_or(""), s.name)
        })
    };

    let sheet = workbook.add_worksheet();
    sheet.set_name(SHEET)?;
    workbook::write_headers(
        sheet,
        &[
            (CODE, false, 12.0),
            (NAME, true, 34.0),
            (SUBGROUP_ID, true, 20.0),
            (SUBGROUP_NAME, false, 34.0),
            (INTERNAL_NUMBER, false, 14.0),
            (DESCRIPTION, false, 34.0),
            (PRICE, true, 12.0),
            (STOCK, false, 10.0),
            (DISCOUNT, false, 17.0),
            (ACTIVE, false, 8.0),
            (DISCONTINUED, false, 11.0),
            (FINISHING, false, 11.0),
        ],
    )?;
    let text = workbook::text_format();
    let amount = Format::new().set_num_format("0.00");
    // Also for rows added in Excel: a number like 00123 keeps its zeros.
    for column in [0, 1, 4, 5] {
        sheet.set_column_format(column, &text)?;
    }
    sheet.set_column_format(6, &amount)?;

    for (index, article) in articles.iter().enumerate() {
        let row = index as u32 + 1;
        sheet.write_string_with_format(row, 0, &article.code, &text)?;
        sheet.write_string_with_format(row, 1, &article.name, &text)?;
        sheet.write_number(row, 2, article.product_subgroup_id as f64)?;
        sheet.write_string_with_format(row, 4, article.internal_number.as_deref().unwrap_or(""), &text)?;
        sheet.write_string_with_format(row, 5, article.description.as_deref().unwrap_or(""), &text)?;
        sheet.write_number_with_format(row, 6, article.price_cents as f64 / 100.0, &amount)?;
        sheet.write_number(row, 7, article.stock as f64)?;
        sheet.write_number(row, 8, article.discount_percent)?;
        sheet.write_string(row, 9, flag_text(article.active))?;
        sheet.write_string(row, 10, flag_text(article.discontinued))?;
        sheet.write_string(row, 11, flag_text(article.is_finishing))?;
    }

    // Shows which subgroup an ID stands for, also in rows added in Excel.
    let last_row = articles.len() as u32 + ROWS_FOR_NEW_ARTICLES;
    for row in 1..=last_row {
        let excel_row = row + 1;
        let formula = format!(
            "=IF(C{excel_row}=\"\",\"\",IFERROR(VLOOKUP(C{excel_row},{LEGEND_SHEET}!$A:$C,2,FALSE)&\" / \"&VLOOKUP(C{excel_row},{LEGEND_SHEET}!$A:$C,3,FALSE),\"Unbekannte ID\"))"
        );
        let result = articles.get(row as usize - 1).map_or(String::new(), |a| subgroup_label(a.product_subgroup_id));
        sheet.write_formula(row, 3, Formula::new(formula).set_result(result))?;
    }

    let yes_no = DataValidation::new().allow_list_strings(&["Ja", "Nein"])?;
    sheet.add_data_validation(1, 9, last_row, 11, &yes_no)?;
    if !subgroups.is_empty() {
        let ids = Formula::new(format!("={LEGEND_SHEET}!$A$2:$A${}", subgroups.len() + 1));
        let id_list = DataValidation::new().allow_list_formula(ids);
        sheet.add_data_validation(1, 2, last_row, 2, &id_list)?;
    }

    let legend = workbook.add_worksheet();
    legend.set_name(LEGEND_SHEET)?;
    workbook::write_headers(legend, &[("ID", true, 8.0), ("Warengruppe", true, 30.0), ("Warenuntergruppe", true, 30.0), (ACTIVE, true, 8.0)])?;
    let mut sorted: Vec<&ProductSubgroup> = subgroups.iter().collect();
    sorted.sort_by_key(|s| (group_names.get(&s.product_group_id).copied().unwrap_or(""), s.name.as_str()));
    for (index, subgroup) in sorted.iter().enumerate() {
        let row = index as u32 + 1;
        legend.write_number(row, 0, subgroup.id as f64)?;
        legend.write_string(row, 1, group_names.get(&subgroup.product_group_id).copied().unwrap_or(""))?;
        legend.write_string(row, 2, &subgroup.name)?;
        legend.write_string(row, 3, flag_text(subgroup.active))?;
    }

    workbook::write_notes(&mut workbook, &NOTES)?;
    Ok(workbook)
}

/// A checked row of the file.
enum Action {
    Create(NewArticle),
    Update(Box<UpdateArticle>),
}

struct Plan {
    preview: ImportPreview,
    actions: Vec<Action>,
}

fn plan(rows: &[SheetRow], articles: &[Article], subgroups: &[ProductSubgroup]) -> Plan {
    let by_code: HashMap<String, &Article> = articles.iter().map(|a| (a.code.to_uppercase(), a)).collect();
    let subgroups: HashMap<i64, &ProductSubgroup> = subgroups.iter().map(|s| (s.id, s)).collect();
    // Articles attached to others must stay finishings.
    let used_as_finishing: HashSet<i64> =
        articles.iter().flat_map(|a| a.components.iter().map(|c| c.component_article_id)).collect();

    let mut plan = Plan {
        preview: ImportPreview { created: Vec::new(), updated: Vec::new(), unchanged: 0, errors: Vec::new() },
        actions: Vec::new(),
    };
    let mut seen_codes = HashSet::new();

    for row in rows {
        let mut errors: Vec<String> = Vec::new();
        let code = row.text(CODE).to_uppercase();
        let existing = if code.is_empty() {
            None
        } else {
            if !seen_codes.insert(code.clone()) {
                errors.push(format!("Art-Nr. {code} kommt mehrfach vor"));
            }
            let found = by_code.get(&code).copied();
            if found.is_none() {
                errors.push(format!("Art-Nr. {code} gibt es nicht. Für neue Artikel das Feld leer lassen"));
            }
            found
        };

        let name = row.text(NAME).to_string();
        if name.is_empty() {
            errors.push("Name fehlt".into());
        }
        let subgroup = match row.text(SUBGROUP_ID) {
            "" => {
                errors.push("Warenuntergruppe-ID fehlt".into());
                None
            }
            text => {
                let found = text.parse().ok().and_then(|id: i64| subgroups.get(&id).copied());
                if found.is_none() {
                    errors.push(format!("Warenuntergruppe-ID {text} gibt es nicht"));
                }
                found
            }
        };
        // An article can stay in a deactivated subgroup, but none is moved there.
        if let Some(subgroup) = subgroup {
            if !subgroup.active && existing.is_none_or(|a| a.product_subgroup_id != subgroup.id) {
                errors.push(format!("Warenuntergruppe «{}» ist deaktiviert", subgroup.name));
            }
        }
        let price_cents = workbook::parse_chf(row.text(PRICE));
        if price_cents.is_none() {
            errors.push(format!("Ungültiger Preis «{}», z.B. 12.50", row.text(PRICE)));
        }
        let stock = workbook::parse_count(row.text(STOCK));
        if stock.is_none() {
            errors.push(format!("Ungültiger Bestand «{}», erwartet wird eine ganze Zahl ab 0", row.text(STOCK)));
        }
        let discount_percent = workbook::parse_percent(row.text(DISCOUNT));
        if discount_percent.is_none() {
            errors.push(format!("Ungültiger Rabatt «{}», erwartet wird 0 bis 100", row.text(DISCOUNT)));
        }
        let mut flag = |header: &str, default: bool| {
            let value = workbook::parse_flag(row.text(header), default);
            if value.is_none() {
                errors.push(format!("{header}: «{}» ist weder Ja noch Nein", row.text(header)));
            }
            value.unwrap_or(default)
        };
        let active = flag(ACTIVE, true);
        let discontinued = flag(DISCONTINUED, false);
        let is_finishing = flag(FINISHING, false);
        if let Some(article) = existing {
            if !is_finishing && used_as_finishing.contains(&article.id) {
                errors.push("Veredelung kann nicht entfernt werden: Der Artikel ist an anderen Artikeln angehängt".into());
            }
        }

        let (Some(subgroup), Some(price_cents), Some(stock), Some(discount_percent), true) =
            (subgroup, price_cents, stock, discount_percent, errors.is_empty())
        else {
            plan.preview.errors.extend(errors.into_iter().map(|message| ImportRowError { row: row.number, message }));
            continue;
        };

        let internal_number = row.optional(INTERNAL_NUMBER);
        let description = row.optional(DESCRIPTION);
        let Some(article) = existing else {
            plan.preview.created.push(ImportChange { row: row.number, label: name.clone(), changes: Vec::new() });
            plan.actions.push(Action::Create(NewArticle {
                name,
                product_group_id: subgroup.product_group_id,
                product_subgroup_id: subgroup.id,
                internal_number,
                description,
                is_finishing,
                price_cents,
                stock,
                discontinued,
                discount_percent,
                component_links: Vec::new(),
            }));
            continue;
        };

        let update = UpdateArticle {
            id: article.id,
            name,
            product_group_id: subgroup.product_group_id,
            product_subgroup_id: subgroup.id,
            internal_number,
            description,
            is_finishing,
            price_cents,
            stock,
            active,
            discontinued,
            discount_percent,
            component_links: Vec::new(),
        };
        let changes = changes_of(article, &update);
        if changes.is_empty() {
            plan.preview.unchanged += 1;
        } else {
            plan.preview.updated.push(ImportChange {
                row: row.number,
                label: format!("{} {}", article.code, article.name),
                changes,
            });
            plan.actions.push(Action::Update(Box::new(update)));
        }
    }
    plan
}

fn changes_of(article: &Article, update: &UpdateArticle) -> Vec<String> {
    let optional = |value: &Option<String>| value.as_deref().unwrap_or("–").to_string();
    let mut changes = Vec::new();
    let mut compare = |label: &str, old: String, new: String| {
        if old != new {
            changes.push(format!("{label}: {old} → {new}"));
        }
    };
    compare(NAME, article.name.clone(), update.name.clone());
    compare(SUBGROUP_ID, article.product_subgroup_id.to_string(), update.product_subgroup_id.to_string());
    compare(INTERNAL_NUMBER, optional(&article.internal_number), optional(&update.internal_number));
    compare(DESCRIPTION, optional(&article.description), optional(&update.description));
    compare("Preis", format_amount(article.price_cents), format_amount(update.price_cents));
    compare(STOCK, article.stock.to_string(), update.stock.to_string());
    compare("Aktions-Rabatt", format!("{} %", article.discount_percent), format!("{} %", update.discount_percent));
    compare(ACTIVE, flag_text(article.active).into(), flag_text(update.active).into());
    compare(DISCONTINUED, flag_text(article.discontinued).into(), flag_text(update.discontinued).into());
    compare(FINISHING, flag_text(article.is_finishing).into(), flag_text(update.is_finishing).into());
    changes
}

async fn load_plan(pool: &SqlitePool, path: &Path) -> Result<(Plan, Vec<Article>), AppError> {
    let rows = workbook::read_sheet(path, SHEET, &IMPORT_HEADERS)?;
    let articles = ArticleRepository::list(pool).await?;
    let subgroups = ProductSubgroupRepository::list(pool).await?;
    Ok((plan(&rows, &articles, &subgroups), articles))
}

pub async fn preview(pool: &SqlitePool, path: &Path) -> Result<ImportPreview, AppError> {
    Ok(load_plan(pool, path).await?.0.preview)
}

/// Takes over the file in one transaction: all of it, or nothing.
pub async fn apply(pool: &SqlitePool, path: &Path) -> Result<ImportResult, AppError> {
    let (plan, articles) = load_plan(pool, path).await?;
    if !plan.preview.errors.is_empty() {
        return Err(AppError::Validation("Die Datei enthält Fehler, es wurde nichts übernommen".into()));
    }

    let mut codes: HashSet<String> = articles.into_iter().map(|a| a.code).collect();
    let mut tx = pool.begin().await?;
    for action in &plan.actions {
        match action {
            Action::Create(article) => {
                let code = loop {
                    let candidate = random_code();
                    if codes.insert(candidate.clone()) {
                        break candidate;
                    }
                };
                ArticleRepository::create_in(&mut tx, &code, article).await?;
            }
            Action::Update(article) => ArticleRepository::update_fields_in(&mut tx, article).await?,
        }
    }
    tx.commit().await?;
    Ok(ImportResult { created: plan.preview.created.len(), updated: plan.preview.updated.len() })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::excel::workbook::tests::write_test_file;

    const SEED: &str = "
        INSERT INTO product_group (id, name) VALUES (1, 'Shirts');
        INSERT INTO product_subgroup (id, name, product_group_id, active)
            VALUES (5, 'Kinder', 1, 1), (6, 'Erwachsene', 1, 1), (7, 'Alt', 1, 0);
        INSERT INTO article (id, code, name, product_group_id, product_subgroup_id, price_cents, stock, is_finishing)
            VALUES (1, 'K7Q2XM', 'Shirt rot', 1, 5, 2500, 3, 0),
                   (2, '00123', 'Druck', 1, 5, 500, 9, 1);
        INSERT INTO article_component (article_id, component_article_id, price_override_cents) VALUES (1, 2, 400);
    ";

    fn with_pool(test: impl AsyncFnOnce(&SqlitePool, &Path)) {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();
            sqlx::raw_sql(SEED).execute(&pool).await.unwrap();
            test(&pool, &dir).await;
            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);
        });
    }

    fn write(path: &Path, rows: &[Vec<&str>]) {
        write_test_file(path, SHEET, &IMPORT_HEADERS, rows);
    }

    #[test]
    fn exported_file_can_be_imported_without_changes() {
        with_pool(async |pool, dir| {
            let path = dir.join("artikel.xlsx");
            export(pool, &path).await.unwrap();
            let preview = preview(pool, &path).await.unwrap();
            assert!(preview.errors.is_empty(), "{:?}", preview.errors);
            assert_eq!((preview.created.len(), preview.updated.len(), preview.unchanged), (0, 0, 2));
        });
    }

    #[test]
    fn imports_new_and_changed_articles_and_keeps_finishings() {
        with_pool(async |pool, dir| {
            let path = dir.join("artikel.xlsx");
            write(
                &path,
                &[
                    vec!["K7Q2XM", "Shirt rot", "6", "M-1", "", "27,50", "4", "10", "Ja", "Nein", "Nein"],
                    vec!["", "Shirt blau", "6", "", "Neu", "30", "", "", "", "", ""],
                ],
            );
            let check = preview(pool, &path).await.unwrap();
            assert!(check.errors.is_empty(), "{:?}", check.errors);
            assert_eq!((check.created.len(), check.updated.len()), (1, 1));
            assert!(check.updated[0].changes.contains(&"Preis: 25.00 → 27.50".to_string()), "{:?}", check.updated[0]);

            let result = apply(pool, &path).await.unwrap();
            assert_eq!((result.created, result.updated), (1, 1));

            let articles = ArticleRepository::list(pool).await.unwrap();
            let red = articles.iter().find(|a| a.code == "K7Q2XM").unwrap();
            assert_eq!((red.price_cents, red.stock, red.product_subgroup_id), (2750, 4, 6));
            assert_eq!(red.discount_percent, 10.0);
            assert_eq!(red.components.len(), 1, "the finishing was lost");
            let blue = articles.iter().find(|a| a.name == "Shirt blau").unwrap();
            assert_eq!((blue.product_group_id, blue.stock, blue.active), (1, 0, true));
            assert_eq!(blue.code.len(), 6);
            // A row missing from the file leaves its article alone.
            assert_eq!(articles.iter().find(|a| a.code == "00123").unwrap().stock, 9);
        });
    }

    #[test]
    fn any_error_keeps_the_whole_file_out() {
        with_pool(async |pool, dir| {
            let path = dir.join("artikel.xlsx");
            write(
                &path,
                &[
                    vec!["", "Gültig", "6", "", "", "10", "", "", "", "", ""],
                    vec!["GIBTESNICHT", "A", "6", "", "", "10", "", "", "", "", ""],
                    vec!["", "", "99", "", "", "abc", "-1", "200", "vielleicht", "", ""],
                    vec!["", "In deaktivierter", "7", "", "", "10", "", "", "", "", ""],
                    vec!["00123", "Druck", "5", "", "", "5", "9", "", "", "", "Nein"],
                ],
            );
            let check = preview(pool, &path).await.unwrap();
            let rows: Vec<u32> = check.errors.iter().map(|e| e.row).collect();
            assert_eq!(rows.iter().filter(|r| **r == 4).count(), 6, "{:?}", check.errors);
            assert!(rows.contains(&3) && rows.contains(&5) && rows.contains(&6), "{:?}", check.errors);
            assert!(!rows.contains(&2));

            assert!(apply(pool, &path).await.is_err());
            assert_eq!(ArticleRepository::list(pool).await.unwrap().len(), 2);
        });
    }

    #[test]
    fn same_number_twice_is_an_error() {
        with_pool(async |pool, dir| {
            let path = dir.join("artikel.xlsx");
            let row = vec!["K7Q2XM", "Shirt rot", "5", "", "", "25", "3", "", "", "", ""];
            write(&path, &[row.clone(), row]);
            let check = preview(pool, &path).await.unwrap();
            assert_eq!(check.errors.len(), 1);
            assert_eq!(check.errors[0].row, 3);
        });
    }
}
