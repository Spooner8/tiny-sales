use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::company_profile::model::CompanyProfile;
use crate::features::company_profile::repository::CompanyProfileRepository;
use crate::features::customer::model::Customer;
use crate::features::customer::repository::CustomerRepository;
use crate::features::sale::repository::SaleRepository;

use super::model::{InvoiceAddress, InvoiceDetail, InvoicePayment};
use super::qr_bill::{self, QrAddress, QrBill, Reference};
use super::repository::InvoiceRepository;

/// Business rules for invoices: the company profile must allow a QR payment
/// part before an invoice is issued, and the issued PDF is kept unchanged.
pub struct InvoiceService;

impl InvoiceService {
    /// Checks that invoices can be issued; returns the payment term in days.
    pub async fn check_issuable(pool: &SqlitePool) -> Result<i64, AppError> {
        let profile = CompanyProfileRepository::get(pool).await?;
        Self::creditor(&profile)?;
        Ok(profile.invoice_payment_days)
    }

    pub async fn get(pool: &SqlitePool, id: i64) -> Result<InvoiceDetail, AppError> {
        let invoice = InvoiceRepository::find(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Rechnung {id} nicht gefunden")))?;
        let sale = SaleRepository::find_with_items(pool, invoice.sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Verkauf {} nicht gefunden", invoice.sale_id)))?;
        let (order_id, customer_id) = InvoiceRepository::order_of_sale(pool, invoice.sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Auftrag zu Rechnung {id} nicht gefunden")))?;
        let customer = CustomerRepository::find_by_id(pool, customer_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Kunde {customer_id} nicht gefunden")))?;
        let profile = CompanyProfileRepository::get(pool).await?;

        let (payment, payment_error) = match Self::payment(&profile, &customer, id, sale.sale.total_cents) {
            Ok(payment) => (Some(payment), None),
            Err(err) => (None, Some(err.to_string())),
        };
        Ok(InvoiceDetail { invoice, order_id, customer, sale, payment, payment_error })
    }

    pub async fn pdf(pool: &SqlitePool, id: i64) -> Result<Vec<u8>, AppError> {
        InvoiceRepository::pdf(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Für Rechnung {id} ist noch kein PDF gespeichert")))
    }

    pub async fn has_pdf(pool: &SqlitePool, id: i64) -> Result<bool, AppError> {
        let invoice = InvoiceRepository::find(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Rechnung {id} nicht gefunden")))?;
        Ok(invoice.has_pdf)
    }

    pub async fn store_pdf(pool: &SqlitePool, id: i64, pdf: &[u8]) -> Result<(), AppError> {
        if !pdf.starts_with(b"%PDF") {
            return Err(AppError::Validation("Das erzeugte PDF ist ungültig".into()));
        }
        InvoiceRepository::store_pdf(pool, id, pdf).await
    }

    /// `paid_on` as "YYYY-MM-DD", or None to mark the invoice as open again.
    pub async fn set_paid_on(pool: &SqlitePool, id: i64, paid_on: Option<String>) -> Result<(), AppError> {
        if let Some(date) = &paid_on {
            let valid = date.len() == 10
                && date.char_indices().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
            if !valid {
                return Err(AppError::Validation(format!("Ungültiges Datum: {date}")));
            }
        }
        InvoiceRepository::set_paid_on(pool, id, paid_on.as_deref()).await
    }

    fn payment(
        profile: &CompanyProfile,
        customer: &Customer,
        invoice_id: i64,
        amount_cents: i64,
    ) -> Result<InvoicePayment, AppError> {
        let (iban, creditor) = Self::creditor(profile)?;
        let debtor = Self::debtor(customer);
        let reference = Reference::for_number(&iban, invoice_id);
        let message = format!("Rechnung {invoice_id}");
        let qr_payload = QrBill {
            iban: &iban,
            creditor: &creditor,
            amount_cents,
            debtor: debtor.as_ref().map(|(qr, _)| qr),
            reference: &reference,
            message: &message,
        }
        .payload();

        Ok(InvoicePayment {
            iban: qr_bill::format_iban(&iban),
            reference: reference.formatted(),
            qr_payload,
            creditor: InvoiceAddress {
                name: profile.name.clone(),
                street: profile.street.clone(),
                postal_city: profile.postal_city.clone(),
            },
            debtor: debtor.map(|(_, address)| address),
            amount_cents,
            message,
        })
    }

    /// The shop's account and address; all of it is required on a QR-bill.
    fn creditor(profile: &CompanyProfile) -> Result<(String, QrAddress), AppError> {
        let missing = |what: &str| {
            AppError::Validation(format!(
                "Für Rechnungen fehlt im Firmenprofil (Einstellungen → Firma): {what}"
            ))
        };
        if profile.name.trim().is_empty() {
            return Err(missing("Firmenname"));
        }
        if profile.street.trim().is_empty() {
            return Err(missing("Strasse"));
        }
        let (postal_code, city) =
            qr_bill::split_postal_city(&profile.postal_city).ok_or_else(|| missing("PLZ und Ort, z.B. 8000 Zürich"))?;
        if profile.iban.is_empty() {
            return Err(missing("IBAN"));
        }
        let iban = qr_bill::normalize_iban(&profile.iban);
        qr_bill::validate_iban(&iban)?;
        Ok((iban, QrAddress::new(&profile.name, &profile.street, &postal_code, &city, "CH")))
    }

    /// The customer as payer, if the address is complete; a company name
    /// takes the place of the person's. Abroad, the country code goes in
    /// front of the postal code, e.g. "DE-10115 Berlin".
    fn debtor(customer: &Customer) -> Option<(QrAddress, InvoiceAddress)> {
        let street = customer.street.as_deref()?;
        let postal_code = customer.postal_code.as_deref()?;
        let city = customer.city.as_deref()?;
        let name = customer.company.clone().unwrap_or_else(|| customer.full_name());
        Some((
            QrAddress::new(&name, street, postal_code, city, &customer.country),
            InvoiceAddress {
                name,
                street: street.to_string(),
                postal_city: match customer.country.as_str() {
                    "CH" => format!("{postal_code} {city}"),
                    country => format!("{country}-{postal_code} {city}"),
                },
            },
        ))
    }
}
