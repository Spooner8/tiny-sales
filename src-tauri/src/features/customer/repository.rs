use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{Customer, NewCustomer};

const SELECT_FIELDS: &str = "id, first_name, last_name, street, postal_code, city, country, phone, mobile, email, gender, company, note, additional_info, active, created_at, updated_at";

pub struct CustomerRepository;

impl CustomerRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<Customer>, AppError> {
        let customers = sqlx::query_as::<_, Customer>(&format!(
            "SELECT {SELECT_FIELDS} FROM customer ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE"
        ))
        .fetch_all(pool)
        .await?;
        Ok(customers)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<Customer>, AppError> {
        let customer = sqlx::query_as::<_, Customer>(&format!("SELECT {SELECT_FIELDS} FROM customer WHERE id = ?"))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(customer)
    }

    pub async fn create(pool: &SqlitePool, input: &NewCustomer) -> Result<i64, AppError> {
        let id = sqlx::query(
            "INSERT INTO customer (first_name, last_name, street, postal_code, city, country, phone, mobile, email, gender, company, note, additional_info)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.street)
        .bind(&input.postal_code)
        .bind(&input.city)
        .bind(&input.country)
        .bind(&input.phone)
        .bind(&input.mobile)
        .bind(&input.email)
        .bind(&input.gender)
        .bind(&input.company)
        .bind(&input.note)
        .bind(&input.additional_info)
        .execute(pool)
        .await?
        .last_insert_rowid();
        Ok(id)
    }

    pub async fn update(pool: &SqlitePool, id: i64, active: bool, input: &NewCustomer) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE customer
             SET first_name = ?, last_name = ?, street = ?, postal_code = ?, city = ?, country = ?, phone = ?, mobile = ?, email = ?,
                 gender = ?, company = ?, note = ?, additional_info = ?, active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
        )
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.street)
        .bind(&input.postal_code)
        .bind(&input.city)
        .bind(&input.country)
        .bind(&input.phone)
        .bind(&input.mobile)
        .bind(&input.email)
        .bind(&input.gender)
        .bind(&input.company)
        .bind(&input.note)
        .bind(&input.additional_info)
        .bind(active)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        sqlx::query("UPDATE customer SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
