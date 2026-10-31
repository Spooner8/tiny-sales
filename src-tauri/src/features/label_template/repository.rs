use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{LabelTemplate, NewLabelTemplate, UpdateLabelTemplate};

const SELECT_FIELDS: &str =
    "id, name, paper_size, orientation, columns, rows, label_width_mm, label_height_mm, gap_x_mm, gap_y_mm, margin_x_mm, margin_y_mm, active";

pub struct LabelTemplateRepository;

impl LabelTemplateRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<LabelTemplate>, AppError> {
        let rows = sqlx::query_as::<_, LabelTemplate>(&format!(
            "SELECT {SELECT_FIELDS} FROM label_template ORDER BY name"
        ))
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<LabelTemplate>, AppError> {
        let row = sqlx::query_as::<_, LabelTemplate>(&format!(
            "SELECT {SELECT_FIELDS} FROM label_template WHERE id = ?"
        ))
        .bind(id)
        .fetch_optional(pool)
        .await?;
        Ok(row)
    }

    pub async fn create(pool: &SqlitePool, input: &NewLabelTemplate) -> Result<LabelTemplate, AppError> {
        let id = sqlx::query(
            "INSERT INTO label_template (name, paper_size, orientation, columns, rows, label_width_mm, label_height_mm, gap_x_mm, gap_y_mm, margin_x_mm, margin_y_mm, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
        )
        .bind(&input.name)
        .bind(&input.paper_size)
        .bind(&input.orientation)
        .bind(input.columns)
        .bind(input.rows)
        .bind(input.label_width_mm)
        .bind(input.label_height_mm)
        .bind(input.gap_x_mm)
        .bind(input.gap_y_mm)
        .bind(input.margin_x_mm)
        .bind(input.margin_y_mm)
        .execute(pool)
        .await?
        .last_insert_rowid();

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Etiketten-Vorlage {id} nach dem Anlegen nicht gefunden")))
    }

    pub async fn update(pool: &SqlitePool, input: &UpdateLabelTemplate) -> Result<LabelTemplate, AppError> {
        sqlx::query(
            "UPDATE label_template
             SET name = ?, paper_size = ?, orientation = ?, columns = ?, rows = ?, label_width_mm = ?, label_height_mm = ?, gap_x_mm = ?, gap_y_mm = ?, margin_x_mm = ?, margin_y_mm = ?, active = ?
             WHERE id = ?",
        )
        .bind(&input.name)
        .bind(&input.paper_size)
        .bind(&input.orientation)
        .bind(input.columns)
        .bind(input.rows)
        .bind(input.label_width_mm)
        .bind(input.label_height_mm)
        .bind(input.gap_x_mm)
        .bind(input.gap_y_mm)
        .bind(input.margin_x_mm)
        .bind(input.margin_y_mm)
        .bind(input.active)
        .bind(input.id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, input.id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Etiketten-Vorlage {} nicht gefunden", input.id)))
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        sqlx::query("UPDATE label_template SET active = 0 WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
