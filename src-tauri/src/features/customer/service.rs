use sqlx::SqlitePool;

use crate::error::AppError;

use super::model::{Customer, NewCustomer, UpdateCustomer};
use super::repository::CustomerRepository;

const GENDERS: [&str; 2] = ["male", "female"];

/// Business rules for customers: first and last name are required, e-mail,
/// phone numbers and the postal code (for the country) must look valid, empty optional fields are stored as
/// NULL, and no two customers share first name, last name and additional
/// info - the additional info tells customers with the same name apart.
/// The same checks run in the customer form (`src/lib/customerChecks.ts`).
pub struct CustomerService;

impl CustomerService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<Customer>, AppError> {
        CustomerRepository::list(pool).await
    }

    pub async fn get(pool: &SqlitePool, id: i64) -> Result<Customer, AppError> {
        CustomerRepository::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Kunde {id} nicht gefunden")))
    }

    pub async fn create(pool: &SqlitePool, input: NewCustomer) -> Result<Customer, AppError> {
        let input = Self::normalize(input)?;
        Self::ensure_not_duplicate(pool, &input, None).await?;
        let id = CustomerRepository::create(pool, &input).await?;
        Self::get(pool, id).await
    }

    pub async fn update(pool: &SqlitePool, input: UpdateCustomer) -> Result<Customer, AppError> {
        Self::get(pool, input.id).await?;
        let fields = Self::normalize(input.fields)?;
        Self::ensure_not_duplicate(pool, &fields, Some(input.id)).await?;
        CustomerRepository::update(pool, input.id, input.active, &fields).await?;
        Self::get(pool, input.id).await
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        CustomerRepository::deactivate(pool, id).await
    }

    fn normalize(input: NewCustomer) -> Result<NewCustomer, AppError> {
        let first_name = input.first_name.trim().to_string();
        let last_name = input.last_name.trim().to_string();
        if first_name.is_empty() {
            return Err(AppError::Validation("Vorname darf nicht leer sein".into()));
        }
        if last_name.is_empty() {
            return Err(AppError::Validation("Nachname darf nicht leer sein".into()));
        }
        let email = optional(input.email);
        if email.as_deref().is_some_and(|e| !is_valid_email(e)) {
            return Err(AppError::Validation("Ungültige E-Mail-Adresse, z.B. name@beispiel.ch".into()));
        }
        let phone = optional(input.phone);
        let mobile = optional(input.mobile);
        for (number, label) in [(&phone, "Telefon"), (&mobile, "Mobil")] {
            if number.as_deref().is_some_and(|n| !is_valid_phone(n)) {
                return Err(AppError::Validation(format!(
                    "{label}: ungültige Nummer, z.B. 079 123 45 67 oder +41 79 123 45 67"
                )));
            }
        }
        let country = input.country.trim().to_uppercase();
        if country.len() != 2 || !country.chars().all(|c| c.is_ascii_uppercase()) {
            return Err(AppError::Validation(format!("Unbekanntes Land: {country}")));
        }
        let postal_code = optional(input.postal_code);
        if let Some(code) = &postal_code {
            if !is_valid_postal_code(&country, code) {
                return Err(AppError::Validation(postal_code_error(&country)));
            }
        }
        let gender = optional(input.gender);
        if gender.as_deref().is_some_and(|g| !GENDERS.contains(&g)) {
            return Err(AppError::Validation("Unbekanntes Geschlecht".into()));
        }
        Ok(NewCustomer {
            first_name,
            last_name,
            street: optional(input.street),
            postal_code,
            city: optional(input.city),
            country,
            phone,
            mobile,
            email,
            gender,
            company: optional(input.company),
            note: optional(input.note),
            additional_info: optional(input.additional_info),
        })
    }

    /// Inactive customers count too: reactivating one is better than a copy.
    async fn ensure_not_duplicate(pool: &SqlitePool, input: &NewCustomer, self_id: Option<i64>) -> Result<(), AppError> {
        let key = duplicate_key(&input.first_name, &input.last_name, input.additional_info.as_deref());
        let existing = CustomerRepository::list(pool).await?.into_iter().find(|c| {
            Some(c.id) != self_id && duplicate_key(&c.first_name, &c.last_name, c.additional_info.as_deref()) == key
        });
        let Some(existing) = existing else {
            return Ok(());
        };
        let info = match &existing.additional_info {
            Some(info) => format!("mit der Zusatzinfo «{info}»"),
            None => "ohne Zusatzinfo".into(),
        };
        let inactive = if existing.active { "" } else { ", deaktiviert" };
        Err(AppError::Validation(format!(
            "Den Kunden «{}» {info} gibt es bereits (Kunden-Nr. {}{inactive}). \
             Für einen weiteren Kunden mit diesem Namen bitte eine abweichende Zusatzinfo erfassen",
            existing.full_name(),
            existing.id
        )))
    }
}

/// Compared without case and extra spaces, so "anna  muster" is "Anna Muster".
fn duplicate_key(first_name: &str, last_name: &str, additional_info: Option<&str>) -> [String; 3] {
    let normalize = |s: &str| s.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase();
    [normalize(first_name), normalize(last_name), normalize(additional_info.unwrap_or(""))]
}

/// Something like name@example.ch: one @, no spaces, a dot in the domain.
fn is_valid_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !domain.contains('@')
        && !email.chars().any(char::is_whitespace)
        && domain.split('.').count() >= 2
        && domain.split('.').all(|part| !part.is_empty())
}

/// Swiss and international numbers as people write them, e.g.
/// "079 123 45 67", "+41 79 123 45 67", "044/123'45'67", "(044) 123-45-67":
/// digits with spaces, / ' - ( ), a leading + and 9 to 15 digits.
fn is_valid_phone(number: &str) -> bool {
    let rest = number.strip_prefix('+').unwrap_or(number);
    let digits = rest.chars().filter(char::is_ascii_digit).count();
    rest.chars().all(|c| c.is_ascii_digit() || " /'-()".contains(c)) && (9..=15).contains(&digits)
}

/// Postal codes of the countries most customers come from; others are only
/// limited to what the QR payment part accepts.
fn is_valid_postal_code(country: &str, code: &str) -> bool {
    let digits = |count: usize| code.len() == count && code.chars().all(|c| c.is_ascii_digit());
    match country {
        "CH" | "LI" | "AT" => digits(4),
        "DE" | "FR" | "IT" => digits(5),
        _ => code.chars().count() <= 16,
    }
}

fn postal_code_error(country: &str) -> String {
    match country {
        "CH" | "LI" | "AT" => format!("PLZ für {country}: 4 Ziffern, z.B. 8000"),
        "DE" | "FR" | "IT" => format!("PLZ für {country}: 5 Ziffern, z.B. 10115"),
        _ => "PLZ: höchstens 16 Zeichen".into(),
    }
}

/// Trimmed, or None if empty.
fn optional(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn customer(first_name: &str, last_name: &str, additional_info: Option<&str>) -> NewCustomer {
        NewCustomer {
            first_name: first_name.into(),
            last_name: last_name.into(),
            street: None,
            postal_code: None,
            city: None,
            country: "CH".into(),
            phone: None,
            mobile: None,
            email: None,
            gender: None,
            company: None,
            note: None,
            additional_info: additional_info.map(Into::into),
        }
    }

    #[test]
    fn checks_email_addresses() {
        assert!(is_valid_email("anna.muster@beispiel.ch"));
        assert!(!is_valid_email("anna.muster@beispiel"));
        assert!(!is_valid_email("anna muster@beispiel.ch"));
        assert!(!is_valid_email("@beispiel.ch"));
        assert!(!is_valid_email("anna@@beispiel.ch"));
        assert!(!is_valid_email("anna@beispiel..ch"));
    }

    #[test]
    fn checks_phone_numbers() {
        for valid in ["079 123 45 67", "+41 79 123 45 67", "0041791234567", "044/123'45'67", "(044) 123-45-67"] {
            assert!(is_valid_phone(valid), "{valid}");
        }
        for invalid in ["12345", "079 123 45 67 ab", "+41 79 + 123 45 67", "0791234567891234"] {
            assert!(!is_valid_phone(invalid), "{invalid}");
        }
    }

    #[test]
    fn checks_postal_codes_per_country() {
        assert!(is_valid_postal_code("CH", "8000"));
        assert!(!is_valid_postal_code("CH", "80000"));
        assert!(is_valid_postal_code("DE", "01067"));
        assert!(!is_valid_postal_code("DE", "8000"));
        assert!(is_valid_postal_code("GB", "SW1A 1AA"));
    }

    #[test]
    fn same_name_needs_a_different_additional_info() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();

            let anna = CustomerService::create(&pool, customer("Anna", "Muster", None)).await.unwrap();
            let err = CustomerService::create(&pool, customer(" anna ", "MUSTER", Some("  "))).await.unwrap_err();
            assert!(err.to_string().contains("gibt es bereits"), "{err}");
            let other = CustomerService::create(&pool, customer("Anna", "Muster", Some("Bern"))).await.unwrap();
            assert!(CustomerService::create(&pool, customer("Anna", "Muster", Some("bern"))).await.is_err());

            // Saving a customer unchanged is no duplicate of itself, but it
            // can't take over the name and info of another one.
            let unchanged = UpdateCustomer { id: anna.id, active: true, fields: customer("Anna", "Muster", None) };
            CustomerService::update(&pool, unchanged).await.unwrap();
            let clash = UpdateCustomer { id: other.id, active: true, fields: customer("Anna", "Muster", None) };
            assert!(CustomerService::update(&pool, clash).await.is_err());

            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);
        });
    }
}
