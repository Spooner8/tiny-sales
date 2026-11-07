//! Reading and writing the Excel files of the import. The columns are found
//! by their headers, so their order in the file doesn't matter.

use std::collections::HashMap;
use std::path::Path;

use calamine::{open_workbook_auto, Data, Reader};
use rust_xlsxwriter::{Color, Format, Workbook, Worksheet, XlsxError};

use crate::error::AppError;

/// One filled row of a sheet.
#[derive(Debug)]
pub struct SheetRow {
    /// Row number as Excel shows it.
    pub number: u32,
    cells: HashMap<String, String>,
}

impl SheetRow {
    /// The trimmed content of a column.
    pub fn text(&self, header: &str) -> &str {
        self.cells.get(header).map_or("", String::as_str)
    }

    /// The content of a column, None if empty.
    pub fn optional(&self, header: &str) -> Option<String> {
        Some(self.text(header).to_string()).filter(|text| !text.is_empty())
    }
}

/// Reads the rows of a sheet. All `headers` must be there: a column deleted
/// by mistake must not empty that field in every row. Other columns are
/// ignored, and so are rows without anything in the given columns.
pub fn read_sheet(path: &Path, sheet: &str, headers: &[&str]) -> Result<Vec<SheetRow>, AppError> {
    let mut workbook = open_workbook_auto(path).map_err(|err| {
        AppError::Validation(format!(
            "Die Datei konnte nicht gelesen werden ({err}). Ist sie vielleicht noch in Excel oder LibreOffice geöffnet?"
        ))
    })?;
    let range = workbook
        .worksheet_range(sheet)
        .map_err(|_| AppError::Validation(format!("Das Tabellenblatt «{sheet}» fehlt in der Datei")))?;
    let first_row = range.start().map_or(0, |(row, _)| row);

    let mut rows = range.rows();
    let file_headers: Vec<String> = rows.next().unwrap_or_default().iter().map(cell_text).collect();
    let missing: Vec<&str> = headers.iter().copied().filter(|h| !file_headers.iter().any(|f| f == h)).collect();
    if !missing.is_empty() {
        return Err(AppError::Validation(format!(
            "Im Tabellenblatt «{sheet}» fehlen die Spalten: {}",
            missing.join(", ")
        )));
    }

    let mut result = Vec::new();
    for (index, row) in rows.enumerate() {
        let cells: HashMap<String, String> = file_headers
            .iter()
            .zip(row)
            .filter(|(header, _)| headers.contains(&header.as_str()))
            .map(|(header, cell)| (header.clone(), cell_text(cell)))
            .filter(|(_, text)| !text.is_empty())
            .collect();
        if !cells.is_empty() {
            // +1 for the header row, +1 because Excel counts from 1.
            result.push(SheetRow { number: first_row + index as u32 + 2, cells });
        }
    }
    Ok(result)
}

fn cell_text(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        // Excel stores every number as a float: 8000 must not become "8000.0".
        Data::Float(value) if value.fract() == 0.0 && value.abs() < 1e15 => format!("{}", *value as i64),
        Data::Bool(value) => (if *value { "Ja" } else { "Nein" }).to_string(),
        other => other.to_string().trim().to_string(),
    }
}

/// Parses an amount like "12.50", "12,5" or "1'234" into Rappen.
pub fn parse_chf(text: &str) -> Option<i64> {
    let text = text.replace('\'', "").replace(',', ".");
    let (francs, rappen) = text.split_once('.').unwrap_or((&text, ""));
    if francs.is_empty() || !francs.bytes().all(|b| b.is_ascii_digit()) || !rappen.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    // Rounded, since Excel can store 27.9 as 27.900000000000002.
    let value: f64 = text.parse().ok()?;
    let cents = (value * 100.0).round();
    (cents < 1e15).then_some(cents as i64)
}

/// A whole number of at least 0; empty counts as 0.
pub fn parse_count(text: &str) -> Option<i64> {
    if text.is_empty() {
        return Some(0);
    }
    text.parse().ok().filter(|count| *count >= 0)
}

/// A percentage from 0 to 100; empty counts as 0.
pub fn parse_percent(text: &str) -> Option<f64> {
    if text.is_empty() {
        return Some(0.0);
    }
    text.replace(',', ".").parse().ok().filter(|percent| (0.0..=100.0).contains(percent))
}

/// "Ja" or "Nein"; empty counts as `default`.
pub fn parse_flag(text: &str, default: bool) -> Option<bool> {
    match text.to_lowercase().as_str() {
        "" => Some(default),
        "ja" => Some(true),
        "nein" => Some(false),
        _ => None,
    }
}

pub fn flag_text(value: bool) -> &'static str {
    if value { "Ja" } else { "Nein" }
}

/// Numbers that must stay exactly as typed, e.g. phone numbers with their
/// leading zero, are stored as text.
pub fn text_format() -> Format {
    Format::new().set_num_format("@")
}

/// Writes the header row: required columns stand out, and it stays in view.
pub fn write_headers(sheet: &mut Worksheet, headers: &[(&str, bool, f64)]) -> Result<(), XlsxError> {
    let required = Format::new().set_bold().set_background_color(Color::RGB(0xF7C6DF));
    let optional = Format::new().set_bold().set_background_color(Color::RGB(0xE6E6E6));
    for (column, (header, is_required, width)) in headers.iter().enumerate() {
        let format = if *is_required { &required } else { &optional };
        sheet.write_string_with_format(0, column as u16, *header, format)?;
        sheet.set_column_width(column as u16, *width)?;
    }
    sheet.set_freeze_panes(1, 0)?;
    Ok(())
}

/// Adds the sheet with the instructions.
pub fn write_notes(workbook: &mut Workbook, notes: &[&str]) -> Result<(), XlsxError> {
    let sheet = workbook.add_worksheet();
    sheet.set_name("Hinweise")?;
    sheet.set_column_width(0, 110)?;
    let wrap = Format::new().set_text_wrap();
    for (row, note) in notes.iter().enumerate() {
        sheet.write_string_with_format(row as u32, 0, *note, &wrap)?;
    }
    Ok(())
}

pub fn save(mut workbook: Workbook, path: &Path) -> Result<(), AppError> {
    workbook.save(path).map_err(|err| {
        AppError::Config(format!(
            "Die Excel-Datei konnte nicht gespeichert werden ({err}). Ist sie vielleicht noch in Excel oder LibreOffice geöffnet?"
        ))
    })
}

pub fn build_error(err: XlsxError) -> AppError {
    AppError::Config(format!("Die Excel-Datei konnte nicht erstellt werden: {err}"))
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// A file as a user could have edited it; every cell as text.
    pub fn write_test_file(path: &Path, sheet_name: &str, headers: &[&str], rows: &[Vec<&str>]) {
        let mut workbook = Workbook::new();
        let sheet = workbook.add_worksheet();
        sheet.set_name(sheet_name).unwrap();
        for (column, header) in headers.iter().enumerate() {
            sheet.write_string(0, column as u16, *header).unwrap();
        }
        for (row, cells) in rows.iter().enumerate() {
            for (column, cell) in cells.iter().enumerate() {
                sheet.write_string(row as u32 + 1, column as u16, *cell).unwrap();
            }
        }
        workbook.save(path).unwrap();
    }

    #[test]
    fn parses_amounts() {
        assert_eq!(parse_chf("12.50"), Some(1250));
        assert_eq!(parse_chf("12,5"), Some(1250));
        assert_eq!(parse_chf("1'234"), Some(123400));
        assert_eq!(parse_chf("27.900000000000002"), Some(2790));
        assert_eq!(parse_chf("-5"), None);
        assert_eq!(parse_chf("abc"), None);
        assert_eq!(parse_chf(""), None);
    }

    #[test]
    fn parses_counts_percents_and_flags() {
        assert_eq!(parse_count(""), Some(0));
        assert_eq!(parse_count("7"), Some(7));
        assert_eq!(parse_count("-1"), None);
        assert_eq!(parse_percent("12,5"), Some(12.5));
        assert_eq!(parse_percent("101"), None);
        assert_eq!(parse_flag("JA", false), Some(true));
        assert_eq!(parse_flag("", true), Some(true));
        assert_eq!(parse_flag("vielleicht", true), None);
    }

    #[test]
    fn reads_numbers_like_they_look_and_skips_empty_rows() {
        let path = std::env::temp_dir().join(format!("tiny-sales-test-{}.xlsx", uuid::Uuid::new_v4()));
        let mut workbook = Workbook::new();
        let sheet = workbook.add_worksheet();
        sheet.set_name("Test").unwrap();
        sheet.write_string(0, 0, "PLZ").unwrap();
        sheet.write_string(0, 1, "Andere").unwrap();
        sheet.write_number(1, 0, 8000.0).unwrap();
        // Nothing in a known column: a row with only a helper formula.
        sheet.write_string(2, 1, "Hilfsspalte").unwrap();
        sheet.write_string(3, 0, " 3000 ").unwrap();
        workbook.save(&path).unwrap();

        let rows = read_sheet(&path, "Test", &["PLZ"]).unwrap();
        assert_eq!(rows.iter().map(|r| (r.number, r.text("PLZ"))).collect::<Vec<_>>(), vec![(2, "8000"), (4, "3000")]);
        assert!(read_sheet(&path, "Test", &["PLZ", "Ort"]).unwrap_err().to_string().contains("Ort"));
        assert!(read_sheet(&path, "Anderes", &["PLZ"]).unwrap_err().to_string().contains("Anderes"));
        let _ = std::fs::remove_file(&path);
    }
}
