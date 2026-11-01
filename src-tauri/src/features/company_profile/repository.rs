use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::CompanyProfile;

pub struct CompanyProfileRepository;

impl CompanyProfileRepository {
    pub async fn get(pool: &SqlitePool) -> Result<CompanyProfile, AppError> {
        let profile = sqlx::query_as::<_, CompanyProfile>(
            "SELECT name, street, postal_city, phone, website, vat_number, receipt_thanks, receipt_signature, logo, logo_mark,
                    iban, invoice_payment_days, vat_rate_percent
             FROM company_profile WHERE id = 1",
        )
        .fetch_one(pool)
        .await?;
        Ok(profile)
    }

    pub async fn save(pool: &SqlitePool, profile: &CompanyProfile) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE company_profile SET
                name = ?, street = ?, postal_city = ?, phone = ?, website = ?, vat_number = ?,
                receipt_thanks = ?, receipt_signature = ?, logo = ?, logo_mark = ?,
                iban = ?, invoice_payment_days = ?, vat_rate_percent = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = 1",
        )
        .bind(&profile.name)
        .bind(&profile.street)
        .bind(&profile.postal_city)
        .bind(&profile.phone)
        .bind(&profile.website)
        .bind(&profile.vat_number)
        .bind(&profile.receipt_thanks)
        .bind(&profile.receipt_signature)
        .bind(&profile.logo)
        .bind(&profile.logo_mark)
        .bind(&profile.iban)
        .bind(profile.invoice_payment_days)
        .bind(profile.vat_rate_percent)
        .execute(pool)
        .await?;
        Ok(())
    }
}
