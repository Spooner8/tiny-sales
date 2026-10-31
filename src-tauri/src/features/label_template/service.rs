use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{LabelTemplate, NewLabelTemplate, UpdateLabelTemplate};
use super::repository::LabelTemplateRepository;

const ALLOWED_PAPER_SIZES: [&str; 2] = ["A4", "A5"];
const ALLOWED_ORIENTATIONS: [&str; 2] = ["portrait", "landscape"];

pub struct LabelTemplateService;

impl LabelTemplateService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<LabelTemplate>, AppError> {
        LabelTemplateRepository::list(pool).await
    }

    pub async fn create(pool: &SqlitePool, input: NewLabelTemplate) -> Result<LabelTemplate, AppError> {
        Self::validate(&input.name, &input.paper_size, &input.orientation, input.columns, input.rows)?;
        LabelTemplateRepository::create(pool, &input).await
    }

    pub async fn update(pool: &SqlitePool, input: UpdateLabelTemplate) -> Result<LabelTemplate, AppError> {
        Self::validate(&input.name, &input.paper_size, &input.orientation, input.columns, input.rows)?;
        LabelTemplateRepository::update(pool, &input).await
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        LabelTemplateRepository::deactivate(pool, id).await
    }

    fn validate(name: &str, paper_size: &str, orientation: &str, columns: i64, rows: i64) -> Result<(), AppError> {
        if name.trim().is_empty() {
            return Err(AppError::Validation("Name darf nicht leer sein".into()));
        }
        if !ALLOWED_PAPER_SIZES.contains(&paper_size) {
            return Err(AppError::Validation(format!("Unbekanntes Papierformat: {paper_size}")));
        }
        if !ALLOWED_ORIENTATIONS.contains(&orientation) {
            return Err(AppError::Validation(format!("Unbekannte Ausrichtung: {orientation}")));
        }
        if columns <= 0 || rows <= 0 {
            return Err(AppError::Validation("Spalten und Zeilen müssen grösser als 0 sein".into()));
        }
        Ok(())
    }
}
