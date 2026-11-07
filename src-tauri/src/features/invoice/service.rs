use sqlx::SqlitePool;

use crate::error::AppError;
use crate::features::company_profile::model::CompanyProfile;
use crate::features::company_profile::repository::CompanyProfileRepository;
use crate::features::customer::model::Customer;
use crate::features::customer::repository::CustomerRepository;
use crate::features::sale::repository::SaleRepository;

use super::model::{
    InvoiceAddress, InvoiceDetail, InvoiceOverview, InvoiceOverviewRecord, InvoicePayment, InvoiceReminder,
    InvoiceReminderDetail, InvoiceStatus,
};
use super::qr_bill::{self, invoice_number, QrAddress, QrBill, Reference};
use super::repository::InvoiceRepository;

/// Payment reminder, first and second dunning letter.
const MAX_REMINDER_LEVEL: i64 = 3;

/// Business rules for invoices: the company profile must allow a QR payment
/// part before an invoice is issued, the issued PDFs are kept unchanged, and
/// only overdue invoices get a reminder, one level after the other.
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
            .ok_or_else(|| AppError::NotFound(format!("Rechnung {} nicht gefunden", invoice_number(id))))?;
        let sale = SaleRepository::find_with_items(pool, invoice.sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Verkauf {} nicht gefunden", invoice.sale_id)))?;
        let (order_id, customer_id) = InvoiceRepository::order_of_sale(pool, invoice.sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Auftrag zu Rechnung {} nicht gefunden", invoice_number(id))))?;
        let customer = CustomerRepository::find_by_id(pool, customer_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Kunde {customer_id} nicht gefunden")))?;
        let profile = CompanyProfileRepository::get(pool).await?;

        let overview = Self::find_overview(pool, id).await?;
        let reminders = InvoiceRepository::reminders_of(pool, id).await?;

        let message = format!("Rechnung {}", invoice_number(id));
        let (payment, payment_error) = match Self::payment(&profile, &customer, id, sale.sale.total_cents, message) {
            Ok(payment) => (Some(payment), None),
            Err(err) => (None, Some(err.to_string())),
        };
        Ok(InvoiceDetail { invoice, overview, reminders, order_id, customer, sale, payment, payment_error })
    }

    pub async fn list_overview(pool: &SqlitePool) -> Result<Vec<InvoiceOverview>, AppError> {
        let today = InvoiceRepository::today(pool).await?;
        let iban = qr_bill::normalize_iban(&CompanyProfileRepository::get(pool).await?.iban);
        let rows = InvoiceRepository::list_overview(pool).await?;
        Ok(rows.into_iter().map(|row| overview(row, &today, &iban)).collect())
    }

    async fn find_overview(pool: &SqlitePool, id: i64) -> Result<InvoiceOverview, AppError> {
        let today = InvoiceRepository::today(pool).await?;
        let iban = qr_bill::normalize_iban(&CompanyProfileRepository::get(pool).await?.iban);
        let row = InvoiceRepository::find_overview(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Rechnung {id} nicht gefunden")))?;
        Ok(overview(row, &today, &iban))
    }

    /// Issues the next reminder of an overdue invoice. The first one is
    /// free; each dunning letter adds the fee from the company profile.
    pub async fn create_reminder(pool: &SqlitePool, invoice_id: i64) -> Result<InvoiceReminder, AppError> {
        let invoice = Self::find_overview(pool, invoice_id).await?;
        match invoice.status {
            InvoiceStatus::Paid => {
                return Err(AppError::Validation(format!("Rechnung {} ist bereits bezahlt", invoice_number(invoice_id))));
            }
            InvoiceStatus::Refunded => {
                return Err(AppError::Validation(format!("Rechnung {} wurde vollständig retourniert", invoice_number(invoice_id))));
            }
            InvoiceStatus::Open => {
                return Err(AppError::Validation(format!("Rechnung {} ist noch nicht überfällig", invoice_number(invoice_id))));
            }
            InvoiceStatus::Overdue => {}
        }
        if invoice.reminder_level >= MAX_REMINDER_LEVEL {
            return Err(AppError::Validation(format!(
                "Für Rechnung {} wurden bereits alle Mahnstufen erstellt",
                invoice_number(invoice_id)
            )));
        }

        // A reminder without a payment part couldn't be sent.
        let profile = CompanyProfileRepository::get(pool).await?;
        Self::creditor(&profile)?;

        let level = invoice.reminder_level + 1;
        let fee_cents = if level >= 2 { profile.reminder_fee_cents } else { 0 };
        let id = InvoiceRepository::create_reminder(
            pool,
            invoice_id,
            level,
            profile.reminder_payment_days,
            fee_cents,
            invoice.outstanding_cents + fee_cents,
        )
        .await?;
        InvoiceRepository::find_reminder(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Mahnung {id} nach dem Anlegen nicht gefunden")))
    }

    pub async fn get_reminder(pool: &SqlitePool, id: i64) -> Result<InvoiceReminderDetail, AppError> {
        let reminder = Self::find_reminder(pool, id).await?;
        let invoice_id = reminder.invoice_id;
        let invoice = InvoiceRepository::find(pool, invoice_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Rechnung {} nicht gefunden", invoice_number(invoice_id))))?;
        let (_, customer_id) = InvoiceRepository::order_of_sale(pool, invoice.sale_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Auftrag zu Rechnung {} nicht gefunden", invoice_number(invoice_id))))?;
        let customer = CustomerRepository::find_by_id(pool, customer_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Kunde {customer_id} nicht gefunden")))?;
        let total_cents = Self::find_overview(pool, invoice_id).await?.total_cents;

        let reminders = InvoiceRepository::reminders_of(pool, invoice_id).await?;
        let fees_cents: i64 = reminders.iter().filter(|r| r.level <= reminder.level).map(|r| r.fee_cents).sum();
        let previous_reminder_at =
            reminders.iter().find(|r| r.level == reminder.level - 1).map(|r| r.created_at.clone());
        // From the issued amount, so a return booked later doesn't change
        // what this letter says.
        let refunded_cents = total_cents + fees_cents - reminder.amount_cents;

        let profile = CompanyProfileRepository::get(pool).await?;
        let message = format!("Rechnung {}, {}", invoice_number(invoice_id), reminder_label(reminder.level));
        let (payment, payment_error) =
            match Self::payment(&profile, &customer, invoice_id, reminder.amount_cents, message) {
                Ok(payment) => (Some(payment), None),
                Err(err) => (None, Some(err.to_string())),
            };
        Ok(InvoiceReminderDetail {
            reminder,
            invoice,
            previous_reminder_at,
            customer,
            total_cents,
            refunded_cents,
            fees_cents,
            payment,
            payment_error,
        })
    }

    async fn find_reminder(pool: &SqlitePool, id: i64) -> Result<InvoiceReminder, AppError> {
        InvoiceRepository::find_reminder(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Mahnung {id} nicht gefunden")))
    }

    pub async fn reminder_has_pdf(pool: &SqlitePool, id: i64) -> Result<bool, AppError> {
        Ok(Self::find_reminder(pool, id).await?.has_pdf)
    }

    /// The stored PDF and the file name to offer for it.
    pub async fn reminder_pdf(pool: &SqlitePool, id: i64) -> Result<(Vec<u8>, String), AppError> {
        let reminder = Self::find_reminder(pool, id).await?;
        let pdf = InvoiceRepository::reminder_pdf(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Für Mahnung {id} ist noch kein PDF gespeichert")))?;
        Ok((pdf, format!("Mahnung-{}-{}.pdf", invoice_number(reminder.invoice_id), reminder.level)))
    }

    pub async fn store_reminder_pdf(pool: &SqlitePool, id: i64, pdf: &[u8]) -> Result<(), AppError> {
        if !pdf.starts_with(b"%PDF") {
            return Err(AppError::Validation("Das erzeugte PDF ist ungültig".into()));
        }
        InvoiceRepository::store_reminder_pdf(pool, id, pdf).await
    }

    pub async fn pdf(pool: &SqlitePool, id: i64) -> Result<Vec<u8>, AppError> {
        InvoiceRepository::pdf(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Für Rechnung {} ist noch kein PDF gespeichert", invoice_number(id))))
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
        message: String,
    ) -> Result<InvoicePayment, AppError> {
        let (iban, creditor) = Self::creditor(profile)?;
        let debtor = Self::debtor(customer);
        // Reminders keep the invoice's reference, so the bank assigns their
        // payment to the same invoice.
        let reference = Reference::for_number(&iban, invoice_id);
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
                "Für Rechnungen fehlt in den Einstellungen: {what}"
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

/// As printed on the letter and in the payment part.
fn reminder_label(level: i64) -> &'static str {
    match level {
        1 => "Zahlungserinnerung",
        2 => "1. Mahnung",
        _ => "2. Mahnung",
    }
}

/// `today` and the dates as "YYYY-MM-DD", which compare chronologically.
fn invoice_status(row: &InvoiceOverviewRecord, due_date: &str, today: &str) -> InvoiceStatus {
    if row.paid_on.is_some() {
        InvoiceStatus::Paid
    } else if row.refunded_cents > 0 && row.refunded_cents >= row.total_cents {
        InvoiceStatus::Refunded
    } else if due_date < today {
        InvoiceStatus::Overdue
    } else {
        InvoiceStatus::Open
    }
}

fn overview(row: InvoiceOverviewRecord, today: &str, iban: &str) -> InvoiceOverview {
    let due_date = row.reminder_due_date.clone().unwrap_or_else(|| row.due_date.clone());
    let status = invoice_status(&row, &due_date, today);
    InvoiceOverview {
        id: row.id,
        reference: Reference::for_number(iban, row.id).formatted(),
        reference_search: qr_bill::reference_search_terms(iban, row.id),
        sale_id: row.sale_id,
        order_id: row.order_id,
        customer_name: row.customer_name,
        customer_company: row.customer_company,
        order_status: row.order_status,
        created_at: row.created_at,
        due_date,
        paid_on: row.paid_on,
        total_cents: row.total_cents,
        refunded_cents: row.refunded_cents,
        fees_cents: row.fees_cents,
        outstanding_cents: row.total_cents - row.refunded_cents + row.fees_cents,
        reminder_level: row.reminder_level,
        status,
        can_remind: status == InvoiceStatus::Overdue && row.reminder_level < MAX_REMINDER_LEVEL,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::customer_order::model::{CompleteCustomerOrder, SaveCustomerOrder, SaveCustomerOrderItem};
    use crate::features::customer_order::service::CustomerOrderService;
    use crate::features::sale::model::PaymentMethod;

    const SEED: &str = "
        INSERT INTO product_group (id, name) VALUES (1, 'Shirts');
        INSERT INTO product_subgroup (id, name, product_group_id) VALUES (1, 'Kinder', 1);
        INSERT INTO article (id, code, name, product_group_id, product_subgroup_id, price_cents, stock)
            VALUES (1, 'A1', 'Shirt', 1, 1, 5000, 5);
        INSERT INTO customer (id, first_name, last_name) VALUES (1, 'Anna', 'Muster');
        UPDATE company_profile SET name = 'Testladen', street = 'Bahnhofstrasse 1', postal_city = '8000 Zürich',
            iban = 'CH44 3199 9123 0008 8901 2', reminder_fee_cents = 2000;
    ";

    fn with_invoice(test: impl AsyncFnOnce(&SqlitePool, i64)) {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let dir = std::env::temp_dir().join(format!("tiny-sales-test-{}", uuid::Uuid::new_v4()));
            let pool = crate::db::connect_and_migrate(&dir.join("tiny-sales.db")).await.unwrap();
            sqlx::raw_sql(SEED).execute(&pool).await.unwrap();
            let order = CustomerOrderService::save(
                &pool,
                SaveCustomerOrder {
                    id: None,
                    customer_id: 1,
                    status: "open".into(),
                    payment_method: PaymentMethod::Invoice,
                    discount: None,
                    items: vec![SaveCustomerOrderItem { id: None, article_id: 1, quantity: 1, discount: None, note: None }],
                },
            )
            .await
            .unwrap();
            let completed = CustomerOrderService::complete(
                &pool,
                CompleteCustomerOrder {
                    order_id: order.id,
                    payment_method: PaymentMethod::Invoice,
                    cash_given_cents: None,
                    discount: None,
                },
            )
            .await
            .unwrap();
            test(&pool, completed.invoice_id.unwrap()).await;
            pool.close().await;
            let _ = std::fs::remove_dir_all(&dir);
        });
    }

    /// Moves all deadlines of the invoice and its reminders into the past.
    async fn let_deadline_pass(pool: &SqlitePool, invoice_id: i64) {
        sqlx::query("UPDATE invoice SET due_date = '2020-01-01' WHERE id = ?")
            .bind(invoice_id)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("UPDATE invoice_reminder SET due_date = '2020-01-01' WHERE invoice_id = ?")
            .bind(invoice_id)
            .execute(pool)
            .await
            .unwrap();
    }

    #[test]
    fn only_overdue_invoices_are_reminded_level_by_level() {
        with_invoice(async |pool, id| {
            let invoice = InvoiceService::find_overview(pool, id).await.unwrap();
            assert_eq!(invoice.status, InvoiceStatus::Open);
            // The list shows what the payment part shows.
            let payment = InvoiceService::get(pool, id).await.unwrap().payment.unwrap();
            assert_eq!(invoice.reference, payment.reference);
            assert!(invoice.reference_search.contains(&payment.reference.replace(' ', "")));
            assert!(InvoiceService::create_reminder(pool, id).await.is_err());

            let_deadline_pass(pool, id).await;
            assert!(InvoiceService::find_overview(pool, id).await.unwrap().can_remind);

            // The payment reminder is free and sets a new deadline.
            let first = InvoiceService::create_reminder(pool, id).await.unwrap();
            assert_eq!((first.level, first.fee_cents, first.amount_cents), (1, 0, 5000));
            assert_eq!(InvoiceService::find_overview(pool, id).await.unwrap().status, InvoiceStatus::Open);
            assert!(InvoiceService::create_reminder(pool, id).await.is_err());

            // Each dunning letter adds the fee.
            let_deadline_pass(pool, id).await;
            let second = InvoiceService::create_reminder(pool, id).await.unwrap();
            assert_eq!((second.level, second.fee_cents, second.amount_cents), (2, 2000, 7000));
            let_deadline_pass(pool, id).await;
            let third = InvoiceService::create_reminder(pool, id).await.unwrap();
            assert_eq!((third.level, third.fee_cents, third.amount_cents), (3, 2000, 9000));

            // No level after the last one, and the letter's sums stay as issued.
            let_deadline_pass(pool, id).await;
            assert!(!InvoiceService::find_overview(pool, id).await.unwrap().can_remind);
            assert!(InvoiceService::create_reminder(pool, id).await.is_err());
            let detail = InvoiceService::get_reminder(pool, third.id).await.unwrap();
            assert_eq!((detail.total_cents, detail.fees_cents, detail.refunded_cents), (5000, 4000, 0));
            assert!(detail.payment.unwrap().qr_payload.contains("\n90.00\nCHF\n"));
        });
    }

    #[test]
    fn paid_and_returned_invoices_are_not_reminded() {
        with_invoice(async |pool, id| {
            let_deadline_pass(pool, id).await;
            InvoiceService::set_paid_on(pool, id, Some("2026-01-01".into())).await.unwrap();
            let paid = InvoiceService::find_overview(pool, id).await.unwrap();
            assert_eq!((paid.status, paid.can_remind), (InvoiceStatus::Paid, false));
            assert!(InvoiceService::create_reminder(pool, id).await.is_err());

            InvoiceService::set_paid_on(pool, id, None).await.unwrap();
            sqlx::query("INSERT INTO sale_return (sale_id, refund_method, total_refund_cents) VALUES (?, 'Cash', 1000)")
                .bind(paid.sale_id)
                .execute(pool)
                .await
                .unwrap();
            // A partial return lowers what is owed.
            let reminder = InvoiceService::create_reminder(pool, id).await.unwrap();
            assert_eq!(reminder.amount_cents, 4000);
            assert_eq!(InvoiceService::get_reminder(pool, reminder.id).await.unwrap().refunded_cents, 1000);

            sqlx::query("INSERT INTO sale_return (sale_id, refund_method, total_refund_cents) VALUES (?, 'Cash', 4000)")
                .bind(paid.sale_id)
                .execute(pool)
                .await
                .unwrap();
            assert_eq!(InvoiceService::find_overview(pool, id).await.unwrap().status, InvoiceStatus::Refunded);
        });
    }
}
