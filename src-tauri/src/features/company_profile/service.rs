use sqlx::SqlitePool;

use crate::error::AppError;

use crate::features::invoice::qr_bill;

use super::model::CompanyProfile;
use super::repository::CompanyProfileRepository;

/// Images are downscaled in the frontend; this only guards the database
/// against something unexpectedly huge.
const MAX_IMAGE_DATA_URL_LEN: usize = 3 * 1024 * 1024;

pub struct CompanyProfileService;

impl CompanyProfileService {
    pub async fn get(pool: &SqlitePool) -> Result<CompanyProfile, AppError> {
        CompanyProfileRepository::get(pool).await
    }

    pub async fn save(pool: &SqlitePool, input: CompanyProfile) -> Result<CompanyProfile, AppError> {
        let iban = qr_bill::normalize_iban(&input.iban);
        if !iban.is_empty() {
            qr_bill::validate_iban(&iban)?;
        }
        if !(0..=365).contains(&input.invoice_payment_days) {
            return Err(AppError::Validation("Zahlungsfrist muss zwischen 0 und 365 Tagen liegen".into()));
        }
        if !(0.0..=100.0).contains(&input.vat_rate_percent) {
            return Err(AppError::Validation("MWST-Satz muss zwischen 0 und 100 % liegen".into()));
        }
        let profile = CompanyProfile {
            name: input.name.trim().to_string(),
            street: input.street.trim().to_string(),
            postal_city: input.postal_city.trim().to_string(),
            phone: input.phone.trim().to_string(),
            website: input.website.trim().to_string(),
            vat_number: input.vat_number.trim().to_string(),
            receipt_thanks: input.receipt_thanks.trim().to_string(),
            receipt_signature: input.receipt_signature.trim().to_string(),
            logo: Self::validate_image(input.logo, "Logo")?,
            logo_mark: Self::validate_image(input.logo_mark, "Logo-Symbol")?,
            iban: qr_bill::format_iban(&iban),
            invoice_payment_days: input.invoice_payment_days,
            vat_rate_percent: input.vat_rate_percent,
        };
        CompanyProfileRepository::save(pool, &profile).await?;
        Ok(profile)
    }

    fn validate_image(image: Option<String>, label: &str) -> Result<Option<String>, AppError> {
        let Some(image) = image.filter(|i| !i.is_empty()) else {
            return Ok(None);
        };
        if !image.starts_with("data:image/") {
            return Err(AppError::Validation(format!("{label}: kein gültiges Bild")));
        }
        if image.len() > MAX_IMAGE_DATA_URL_LEN {
            return Err(AppError::Validation(format!("{label}: Bild ist zu gross")));
        }
        Ok(Some(image))
    }
}
