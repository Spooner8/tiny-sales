//! Export and import of customers.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use rust_xlsxwriter::{DataValidation, Workbook, XlsxError};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::customer::model::{Customer, NewCustomer};
use crate::features::customer::repository::CustomerRepository;
use crate::features::customer::service::{duplicate_key, CustomerService};

use super::model::{ImportChange, ImportPreview, ImportResult, ImportRowError};
use super::workbook::{self, flag_text, SheetRow};

const SHEET: &str = "Kunden";

const ID: &str = "Kunden-Nr.";
const COMPANY: &str = "Firma";
const FIRST_NAME: &str = "Vorname";
const LAST_NAME: &str = "Nachname";
const STREET: &str = "Strasse und Hausnummer";
const POSTAL_CODE: &str = "PLZ";
const CITY: &str = "Ort";
const COUNTRY: &str = "Land";
const PHONE: &str = "Telefon";
const MOBILE: &str = "Mobil";
const EMAIL: &str = "E-Mail";
const GENDER: &str = "Geschlecht";
const NOTE: &str = "Notiz";
const ADDITIONAL_INFO: &str = "Zusatzinfo";
const ACTIVE: &str = "Aktiv";

const HEADERS: [&str; 15] = [
    ID,
    COMPANY,
    FIRST_NAME,
    LAST_NAME,
    STREET,
    POSTAL_CODE,
    CITY,
    COUNTRY,
    PHONE,
    MOBILE,
    EMAIL,
    GENDER,
    NOTE,
    ADDITIONAL_INFO,
    ACTIVE,
];

const MALE: &str = "Männlich";
const FEMALE: &str = "Weiblich";

/// Rows prepared with dropdowns, for adding customers.
const ROWS_FOR_NEW_CUSTOMERS: u32 = 1000;

const NOTES: [&str; 7] = [
    "Kunden importieren und anpassen",
    "Zeile ohne Kunden-Nr.: ein neuer Kunde, die Nummer vergibt das Programm. Zeile mit Kunden-Nr.: dieser Kunde wird angepasst.",
    "Pflichtfelder (rosa): Vorname und Nachname. Gleich wie im Programm dürfen zwei Kunden nur dann gleich heissen, wenn ihre Zusatzinfo abweicht.",
    "Land als Kürzel, z.B. CH, DE, AT; leer zählt als CH. Die PLZ wird je nach Land geprüft, Telefon, Mobil und E-Mail wie im Programm.",
    "Leeres Feld: Aktiv zählt als Ja, die übrigen Angaben werden geleert.",
    "Kunden werden nie gelöscht. Eine fehlende Zeile lässt den Kunden unverändert; zum Ausblenden «Aktiv» auf Nein setzen.",
    "Vor dem Übernehmen zeigt das Programm alle Änderungen. Enthält die Datei einen Fehler, wird nichts übernommen.",
];

pub async fn export(pool: &SqlitePool, path: &Path) -> Result<(), AppError> {
    let customers = CustomerRepository::list(pool).await?;
    let workbook = build_workbook(&customers).map_err(workbook::build_error)?;
    workbook::save(workbook, path)
}

fn build_workbook(customers: &[Customer]) -> Result<Workbook, XlsxError> {
    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();
    sheet.set_name(SHEET)?;
    workbook::write_headers(
        sheet,
        &[
            (ID, false, 11.0),
            (COMPANY, false, 26.0),
            (FIRST_NAME, true, 16.0),
            (LAST_NAME, true, 18.0),
            (STREET, false, 28.0),
            (POSTAL_CODE, false, 8.0),
            (CITY, false, 18.0),
            (COUNTRY, false, 7.0),
            (PHONE, false, 17.0),
            (MOBILE, false, 17.0),
            (EMAIL, false, 28.0),
            (GENDER, false, 11.0),
            (NOTE, false, 28.0),
            (ADDITIONAL_INFO, false, 28.0),
            (ACTIVE, false, 7.0),
        ],
    )?;
    // Text, also for rows added in Excel: a phone number keeps its leading
    // zero, a postal code stays what it is.
    let text = workbook::text_format();
    for column in 1..=13 {
        sheet.set_column_format(column, &text)?;
    }

    for (index, customer) in customers.iter().enumerate() {
        let row = index as u32 + 1;
        sheet.write_number(row, 0, customer.id as f64)?;
        let cells = [
            customer.company.as_deref(),
            Some(customer.first_name.as_str()),
            Some(customer.last_name.as_str()),
            customer.street.as_deref(),
            customer.postal_code.as_deref(),
            customer.city.as_deref(),
            Some(customer.country.as_str()),
            customer.phone.as_deref(),
            customer.mobile.as_deref(),
            customer.email.as_deref(),
            customer.gender.as_deref().map(gender_label),
            customer.note.as_deref(),
            customer.additional_info.as_deref(),
        ];
        for (offset, cell) in cells.iter().enumerate() {
            sheet.write_string_with_format(row, offset as u16 + 1, cell.unwrap_or(""), &text)?;
        }
        sheet.write_string(row, 14, flag_text(customer.active))?;
    }

    let last_row = customers.len() as u32 + ROWS_FOR_NEW_CUSTOMERS;
    let genders = DataValidation::new().allow_list_strings(&[MALE, FEMALE])?;
    sheet.add_data_validation(1, 11, last_row, 11, &genders)?;
    let yes_no = DataValidation::new().allow_list_strings(&["Ja", "Nein"])?;
    sheet.add_data_validation(1, 14, last_row, 14, &yes_no)?;

    workbook::write_notes(&mut workbook, &NOTES)?;
    Ok(workbook)
}

fn gender_label(gender: &str) -> &'static str {
    if gender == "male" { MALE } else { FEMALE }
}

enum Action {
    Create(NewCustomer),
    Update { id: i64, active: bool, fields: NewCustomer },
}

struct Plan {
    preview: ImportPreview,
    actions: Vec<Action>,
}

/// A row that passed the checks of a single customer.
struct CheckedRow {
    number: u32,
    existing_id: Option<i64>,
    active: bool,
    fields: NewCustomer,
}

fn check_row(
    row: &SheetRow,
    existing: &HashMap<i64, &Customer>,
    seen_ids: &mut HashSet<i64>,
) -> Result<CheckedRow, Vec<String>> {
    let mut errors = Vec::new();
    let existing_id = match row.text(ID) {
        "" => None,
        text => match text.parse::<i64>().ok().filter(|id| existing.contains_key(id)) {
            Some(id) => {
                if !seen_ids.insert(id) {
                    errors.push(format!("Kunden-Nr. {id} kommt mehrfach vor"));
                }
                Some(id)
            }
            None => {
                errors.push(format!("Kunden-Nr. {text} gibt es nicht. Für neue Kunden das Feld leer lassen"));
                None
            }
        },
    };
    let active = workbook::parse_flag(row.text(ACTIVE), true).unwrap_or_else(|| {
        errors.push(format!("{ACTIVE}: «{}» ist weder Ja noch Nein", row.text(ACTIVE)));
        true
    });
    let gender = match row.text(GENDER).to_lowercase().as_str() {
        "" => None,
        "männlich" => Some("male".to_string()),
        "weiblich" => Some("female".to_string()),
        _ => {
            errors.push(format!("{GENDER}: «{}» ist weder {MALE} noch {FEMALE}", row.text(GENDER)));
            None
        }
    };
    let country = Some(row.text(COUNTRY)).filter(|c| !c.is_empty()).unwrap_or("CH").to_string();

    // The same rules as in the customer form.
    let fields = CustomerService::normalize(NewCustomer {
        first_name: row.text(FIRST_NAME).to_string(),
        last_name: row.text(LAST_NAME).to_string(),
        street: row.optional(STREET),
        postal_code: row.optional(POSTAL_CODE),
        city: row.optional(CITY),
        country,
        phone: row.optional(PHONE),
        mobile: row.optional(MOBILE),
        email: row.optional(EMAIL),
        gender,
        company: row.optional(COMPANY),
        note: row.optional(NOTE),
        additional_info: row.optional(ADDITIONAL_INFO),
    });
    match fields {
        Ok(fields) if errors.is_empty() => Ok(CheckedRow { number: row.number, existing_id, active, fields }),
        Ok(_) => Err(errors),
        Err(AppError::Validation(message)) => {
            errors.push(message);
            Err(errors)
        }
        Err(other) => {
            errors.push(other.to_string());
            Err(errors)
        }
    }
}

fn plan(rows: &[SheetRow], customers: &[Customer]) -> Plan {
    let by_id: HashMap<i64, &Customer> = customers.iter().map(|c| (c.id, c)).collect();
    let mut plan = Plan {
        preview: ImportPreview { created: Vec::new(), updated: Vec::new(), unchanged: 0, errors: Vec::new() },
        actions: Vec::new(),
    };

    let mut seen_ids = HashSet::new();
    let mut checked = Vec::new();
    for row in rows {
        match check_row(row, &by_id, &mut seen_ids) {
            Ok(row) => checked.push(row),
            Err(errors) => {
                plan.preview.errors.extend(errors.into_iter().map(|message| ImportRowError { row: row.number, message }));
            }
        }
    }

    // Duplicates are judged on the result of the import: customers not
    // changed by the file keep their name, those in it take the new one.
    let replaced: HashSet<i64> = checked.iter().filter_map(|c| c.existing_id).collect();
    let mut taken: HashMap<[String; 3], String> = customers
        .iter()
        .filter(|c| !replaced.contains(&c.id))
        .map(|c| {
            (duplicate_key(&c.first_name, &c.last_name, c.additional_info.as_deref()), format!("Kunden-Nr. {}", c.id))
        })
        .collect();

    for row in checked {
        let CheckedRow { number, existing_id, active, fields } = row;
        let key = duplicate_key(&fields.first_name, &fields.last_name, fields.additional_info.as_deref());
        if let Some(other) = taken.get(&key) {
            plan.preview.errors.push(ImportRowError {
                row: number,
                message: format!(
                    "Doublette: {} {} mit derselben Zusatzinfo gibt es bereits ({other}). Bitte eine abweichende Zusatzinfo erfassen",
                    fields.first_name, fields.last_name
                ),
            });
            continue;
        }
        taken.insert(key, format!("Zeile {number}"));

        let name = format!("{} {}", fields.first_name, fields.last_name);
        match existing_id.and_then(|id| by_id.get(&id).copied()) {
            None => {
                plan.preview.created.push(ImportChange { row: number, label: name, changes: Vec::new() });
                plan.actions.push(Action::Create(fields));
            }
            Some(customer) => {
                let changes = changes_of(customer, active, &fields);
                if changes.is_empty() {
                    plan.preview.unchanged += 1;
                } else {
                    plan.preview.updated.push(ImportChange {
                        row: number,
                        label: format!("{} {}", customer.id, customer.full_name()),
                        changes,
                    });
                    plan.actions.push(Action::Update { id: customer.id, active, fields });
                }
            }
        }
    }
    plan
}

fn changes_of(customer: &Customer, active: bool, new: &NewCustomer) -> Vec<String> {
    let mut changes = Vec::new();
    let mut compare = |label: &str, old: &str, new: &str| {
        if old != new {
            let shown = |value: &str| if value.is_empty() { "–".to_string() } else { value.to_string() };
            changes.push(format!("{label}: {} → {}", shown(old), shown(new)));
        }
    };
    let text = |value: &Option<String>| value.clone().unwrap_or_default();
    let gender = |value: &Option<String>| value.as_deref().map_or("", gender_label).to_string();
    compare(COMPANY, &text(&customer.company), &text(&new.company));
    compare(FIRST_NAME, &customer.first_name, &new.first_name);
    compare(LAST_NAME, &customer.last_name, &new.last_name);
    compare(STREET, &text(&customer.street), &text(&new.street));
    compare(POSTAL_CODE, &text(&customer.postal_code), &text(&new.postal_code));
    compare(CITY, &text(&customer.city), &text(&new.city));
    compare(COUNTRY, &customer.country, &new.country);
    compare(PHONE, &text(&customer.phone), &text(&new.phone));
    compare(MOBILE, &text(&customer.mobile), &text(&new.mobile));
    compare(EMAIL, &text(&customer.email), &text(&new.email));
    compare(GENDER, &gender(&customer.gender), &gender(&new.gender));
    compare(NOTE, &text(&customer.note), &text(&new.note));
    compare(ADDITIONAL_INFO, &text(&customer.additional_info), &text(&new.additional_info));
    compare(ACTIVE, flag_text(customer.active), flag_text(active));
    changes
}

async fn load_plan(pool: &SqlitePool, path: &Path) -> Result<Plan, AppError> {
    let rows = workbook::read_sheet(path, SHEET, &HEADERS)?;
    let customers = CustomerRepository::list(pool).await?;
    Ok(plan(&rows, &customers))
}

pub async fn preview(pool: &SqlitePool, path: &Path) -> Result<ImportPreview, AppError> {
    Ok(load_plan(pool, path).await?.preview)
}

/// Takes over the file in one transaction: all of it, or nothing.
pub async fn apply(pool: &SqlitePool, path: &Path) -> Result<ImportResult, AppError> {
    let plan = load_plan(pool, path).await?;
    if !plan.preview.errors.is_empty() {
        return Err(AppError::Validation("Die Datei enthält Fehler, es wurde nichts übernommen".into()));
    }
    let mut tx = pool.begin().await?;
    for action in &plan.actions {
        match action {
            Action::Create(customer) => {
                CustomerRepository::create(&mut *tx, customer).await?;
            }
            Action::Update { id, active, fields } => {
                CustomerRepository::update(&mut *tx, *id, *active, fields).await?;
            }
        }
    }
    tx.commit().await?;
    Ok(ImportResult { created: plan.preview.created.len(), updated: plan.preview.updated.len() })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::excel::workbook::tests::write_test_file;

    fn with_pool(test: impl AsyncFnOnce(&SqlitePool, &Path)) {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();
            sqlx::raw_sql(
                "INSERT INTO customer (id, first_name, last_name, company, postal_code, country, phone, gender)
                    VALUES (1, 'Anna', 'Muster', 'Muster AG', '08000', 'IT', '079 123 45 67', 'female'),
                           (2, 'Max', 'Meier', NULL, NULL, 'CH', NULL, NULL);",
            )
            .execute(&pool)
            .await
            .unwrap();
            test(&pool, &dir).await;
            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);
        });
    }

    fn write(path: &Path, rows: &[Vec<&str>]) {
        write_test_file(path, SHEET, &HEADERS, rows);
    }

    /// Kunden-Nr., Vorname, Nachname, Zusatzinfo, Telefon; the rest empty.
    fn row<'a>(id: &'a str, first: &'a str, last: &'a str, info: &'a str, phone: &'a str) -> Vec<&'a str> {
        vec![id, "", first, last, "", "", "", "", phone, "", "", "", "", info, ""]
    }

    #[test]
    fn exported_file_can_be_imported_without_changes() {
        with_pool(async |pool, dir| {
            let path = dir.join("kunden.xlsx");
            export(pool, &path).await.unwrap();
            let preview = preview(pool, &path).await.unwrap();
            assert!(preview.errors.is_empty(), "{:?}", preview.errors);
            assert_eq!((preview.created.len(), preview.updated.len(), preview.unchanged), (0, 0, 2));
        });
    }

    #[test]
    fn imports_new_and_changed_customers() {
        with_pool(async |pool, dir| {
            let path = dir.join("kunden.xlsx");
            write(&path, &[row("2", "Max", "Meier", "Bern", "044 123 45 67"), row("", "Lea", "Keller", "", "")]);
            let check = preview(pool, &path).await.unwrap();
            assert!(check.errors.is_empty(), "{:?}", check.errors);
            assert_eq!((check.created.len(), check.updated.len()), (1, 1));

            let result = apply(pool, &path).await.unwrap();
            assert_eq!((result.created, result.updated), (1, 1));
            let customers = CustomerRepository::list(pool).await.unwrap();
            assert_eq!(customers.len(), 3);
            let max = customers.iter().find(|c| c.id == 2).unwrap();
            assert_eq!(max.phone.as_deref(), Some("044 123 45 67"));
            assert_eq!(max.additional_info.as_deref(), Some("Bern"));
            assert_eq!(customers.iter().find(|c| c.first_name == "Lea").unwrap().country, "CH");
        });
    }

    #[test]
    fn duplicates_and_invalid_values_keep_the_whole_file_out() {
        with_pool(async |pool, dir| {
            let path = dir.join("kunden.xlsx");
            write(
                &path,
                &[
                    row("", "Anna", "Muster", "", ""),
                    row("", "Neu", "Kunde", "", ""),
                    row("", "NEU", "kunde", "", ""),
                    row("", "Lea", "Keller", "", "abc"),
                    row("99", "Tom", "Graf", "", ""),
                    row("", "", "", "nur Info", ""),
                ],
            );
            let check = preview(pool, &path).await.unwrap();
            let rows: Vec<u32> = check.errors.iter().map(|e| e.row).collect();
            assert_eq!(rows, vec![5, 6, 7, 2, 4], "{:?}", check.errors);
            assert!(apply(pool, &path).await.is_err());
            assert_eq!(CustomerRepository::list(pool).await.unwrap().len(), 2);
        });
    }

    #[test]
    fn names_can_be_swapped_within_a_file() {
        with_pool(async |pool, dir| {
            let path = dir.join("kunden.xlsx");
            write(&path, &[row("1", "Max", "Meier", "", ""), row("2", "Anna", "Muster", "", "")]);
            let check = preview(pool, &path).await.unwrap();
            assert!(check.errors.is_empty(), "{:?}", check.errors);
        });
    }
}
