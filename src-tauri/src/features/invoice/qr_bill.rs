//! Swiss QR-bill (QR-Rechnung) rules: IBAN checks, payment references and
//! the content of the Swiss QR code, after the SIX Implementation
//! Guidelines (version 2.3, structured addresses only).

use crate::error::AppError;

/// A structured address ("S") as the QR code carries it.
#[derive(Debug, Clone, PartialEq)]
pub struct QrAddress {
    pub name: String,
    pub street: String,
    pub building_number: String,
    pub postal_code: String,
    pub city: String,
    /// ISO 3166 code, e.g. "CH" or "DE".
    pub country: String,
}

impl QrAddress {
    /// `street` holds street and house number in one line, as entered in
    /// the app; the QR code wants the house number separately.
    pub fn new(name: &str, street: &str, postal_code: &str, city: &str, country: &str) -> Self {
        let (street, building_number) = split_house_number(street.trim());
        Self {
            name: truncate(name.trim(), 70),
            street: truncate(&street, 70),
            building_number: truncate(&building_number, 16),
            postal_code: truncate(postal_code.trim(), 16),
            city: truncate(city.trim(), 35),
            country: country.to_string(),
        }
    }

    fn lines(&self) -> [&str; 7] {
        ["S", &self.name, &self.street, &self.building_number, &self.postal_code, &self.city, &self.country]
    }
}

/// The payment reference, depending on the account: a QR-IBAN needs a QR
/// reference, a regular IBAN gets a creditor reference (ISO 11649).
#[derive(Debug, Clone, PartialEq)]
pub enum Reference {
    Qr(String),
    Creditor(String),
}

impl Reference {
    pub fn for_number(iban: &str, number: i64) -> Self {
        if is_qr_iban(iban) {
            Reference::Qr(qr_reference(number))
        } else {
            Reference::Creditor(creditor_reference(number))
        }
    }

    fn type_code(&self) -> &'static str {
        match self {
            Reference::Qr(_) => "QRR",
            Reference::Creditor(_) => "SCOR",
        }
    }

    pub fn value(&self) -> &str {
        match self {
            Reference::Qr(value) | Reference::Creditor(value) => value,
        }
    }

    /// As printed on the payment part: a QR reference in blocks of five
    /// from the right, a creditor reference in blocks of four.
    pub fn formatted(&self) -> String {
        match self {
            Reference::Qr(value) => {
                let head = value.len() % 5;
                let mut blocks = Vec::new();
                if head > 0 {
                    blocks.push(&value[..head]);
                }
                blocks.extend(value[head..].as_bytes().chunks(5).map(|c| std::str::from_utf8(c).unwrap()));
                blocks.join(" ")
            }
            Reference::Creditor(value) => in_blocks_of_four(value),
        }
    }
}

/// Everything the Swiss QR code of an invoice contains.
pub struct QrBill<'a> {
    pub iban: &'a str,
    pub creditor: &'a QrAddress,
    pub amount_cents: i64,
    pub debtor: Option<&'a QrAddress>,
    pub reference: &'a Reference,
    pub message: &'a str,
}

impl QrBill<'_> {
    /// The text encoded in the QR code; elements separated by line feeds,
    /// empty optional elements still take their line.
    pub fn payload(&self) -> String {
        let amount = if self.amount_cents > 0 { format_amount(self.amount_cents) } else { String::new() };
        let message = truncate(self.message, 140);
        let mut lines: Vec<&str> = vec!["SPC", "0200", "1", self.iban];
        lines.extend(self.creditor.lines());
        // Ultimate creditor: reserved, always empty.
        lines.extend([""; 7]);
        lines.push(&amount);
        lines.push("CHF");
        match self.debtor {
            Some(debtor) => lines.extend(debtor.lines()),
            None => lines.extend([""; 7]),
        }
        lines.push(self.reference.type_code());
        lines.push(self.reference.value());
        lines.push(&message);
        lines.push("EPD");
        lines.join("\n")
    }
}

/// IBAN without spaces, upper case.
pub fn normalize_iban(iban: &str) -> String {
    iban.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_uppercase()
}

/// QR-bills are only for Swiss and Liechtenstein accounts.
pub fn validate_iban(iban: &str) -> Result<(), AppError> {
    let valid_format = iban.len() == 21
        && (iban.starts_with("CH") || iban.starts_with("LI"))
        && iban.chars().all(|c| c.is_ascii_alphanumeric());
    if !valid_format || mod97(&format!("{}{}", &iban[4..], &iban[..4])) != 1 {
        return Err(AppError::Validation(format!(
            "Ungültige IBAN: {iban}. Erwartet wird eine Schweizer oder Liechtensteiner IBAN, z.B. CH44 3199 9123 0008 8901 2"
        )));
    }
    Ok(())
}

/// A QR-IBAN has an institution id from 30000 to 31999.
pub fn is_qr_iban(iban: &str) -> bool {
    iban.get(4..9)
        .and_then(|iid| iid.parse::<u32>().ok())
        .is_some_and(|iid| (30000..=31999).contains(&iid))
}

pub fn format_iban(iban: &str) -> String {
    in_blocks_of_four(iban)
}

/// e.g. 1949.75
pub fn format_amount(cents: i64) -> String {
    format!("{}.{:02}", cents / 100, cents % 100)
}

/// 27-digit QR reference: the number, zero-padded, plus a check digit
/// (modulo 10, recursive).
pub fn qr_reference(number: i64) -> String {
    with_check_digit(&format!("{number:026}"))
}

/// Appends the modulo 10 recursive check digit.
fn with_check_digit(digits: &str) -> String {
    const TABLE: [u32; 10] = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
    let carry = digits
        .chars()
        .filter_map(|c| c.to_digit(10))
        .fold(0, |carry, digit| TABLE[((carry + digit) % 10) as usize]);
    format!("{digits}{}", (10 - carry) % 10)
}

/// Invoice numbers have five digits: invoice 1 is "00001".
pub fn invoice_number(id: i64) -> String {
    format!("{id:05}")
}

/// Creditor reference after ISO 11649: "RF", two check digits, the invoice
/// number.
pub fn creditor_reference(number: i64) -> String {
    creditor_reference_of(&invoice_number(number))
}

fn creditor_reference_of(reference: &str) -> String {
    let check = 98 - mod97(&format!("{reference}RF00"));
    format!("RF{check:02}{reference}")
}

/// Every reference a payment for this invoice can carry, without spaces, to
/// find the invoice from a bank statement. Invoices issued before numbers had
/// five digits carry the short form.
pub fn reference_search_terms(iban: &str, number: i64) -> String {
    let mut terms = vec![creditor_reference(number), creditor_reference_of(&number.to_string())];
    if is_qr_iban(iban) {
        terms.push(qr_reference(number));
    }
    terms.join(" ")
}

/// "8000 Zürich" into postal code and city.
pub fn split_postal_city(postal_city: &str) -> Option<(String, String)> {
    let (postal_code, city) = postal_city.trim().split_once(char::is_whitespace)?;
    let city = city.trim();
    if !postal_code.chars().any(|c| c.is_ascii_digit()) || city.is_empty() {
        return None;
    }
    Some((postal_code.to_string(), city.to_string()))
}

/// "Bahnhofstrasse 12a" into "Bahnhofstrasse" and "12a"; without a
/// trailing number, the house number stays empty.
fn split_house_number(street: &str) -> (String, String) {
    match street.rsplit_once(char::is_whitespace) {
        Some((name, number)) if number.starts_with(|c: char| c.is_ascii_digit()) => {
            (name.trim().to_string(), number.to_string())
        }
        _ => (street.to_string(), String::new()),
    }
}

/// Remainder modulo 97 of a text whose letters count as 10 (A) to 35 (Z).
fn mod97(text: &str) -> u32 {
    text.chars().fold(0, |rest, c| {
        let value = c.to_digit(36).unwrap_or(0);
        if value >= 10 { (rest * 100 + value) % 97 } else { (rest * 10 + value) % 97 }
    })
}

fn in_blocks_of_four(text: &str) -> String {
    text.as_bytes()
        .chunks(4)
        .map(|c| std::str::from_utf8(c).unwrap())
        .collect::<Vec<_>>()
        .join(" ")
}

fn truncate(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_ibans() {
        assert!(validate_iban("CH4431999123000889012").is_ok());
        assert!(validate_iban("CH9300762011623852957").is_ok());
        assert!(validate_iban("CH9300762011623852958").is_err());
        assert!(validate_iban("DE89370400440532013000").is_err());
        assert_eq!(normalize_iban("ch44 3199 9123 0008 8901 2"), "CH4431999123000889012");
    }

    #[test]
    fn recognises_qr_ibans() {
        assert!(is_qr_iban("CH4431999123000889012"));
        assert!(!is_qr_iban("CH9300762011623852957"));
    }

    #[test]
    fn qr_reference_has_check_digit() {
        // Example from the SIX implementation guidelines.
        assert_eq!(with_check_digit("21000000000313947143000901"), "210000000003139471430009017");
        assert_eq!(qr_reference(42), "000000000000000000000000420");
        assert_eq!(
            Reference::Qr(with_check_digit("21000000000313947143000901")).formatted(),
            "21 00000 00003 13947 14300 09017"
        );
    }

    #[test]
    fn creditor_reference_has_check_digits() {
        // Example from ISO 11649.
        assert_eq!(creditor_reference(539007547034), "RF18539007547034");
        assert_eq!(Reference::Creditor(creditor_reference(539007547034)).formatted(), "RF18 5390 0754 7034");
        // Five digits don't change the check digits of the short form.
        assert_eq!(creditor_reference(3), "RF2000003");
        assert_eq!(Reference::Creditor(creditor_reference(3)).formatted(), "RF20 0000 3");
    }

    #[test]
    fn invoice_is_found_by_every_reference_it_can_carry() {
        assert_eq!(reference_search_terms("CH9300762011623852957", 3), "RF2000003 RF203");
        assert_eq!(
            reference_search_terms("CH4431999123000889012", 42),
            "RF3400042 RF3442 000000000000000000000000420"
        );
    }

    #[test]
    fn splits_addresses() {
        assert_eq!(split_postal_city("8000  Zürich"), Some(("8000".into(), "Zürich".into())));
        assert_eq!(split_postal_city("Zürich"), None);
        let address = QrAddress::new("Muster AG", "Rue du Lac 12a", "1000", "Lausanne", "CH");
        assert_eq!((address.street.as_str(), address.building_number.as_str()), ("Rue du Lac", "12a"));
        let address = QrAddress::new("Muster AG", "Postfach", "1000", "Lausanne", "CH");
        assert_eq!((address.street.as_str(), address.building_number.as_str()), ("Postfach", ""));
    }

    #[test]
    fn payload_has_all_elements() {
        let creditor = QrAddress::new("Muster AG", "Bahnhofstrasse 1", "8000", "Zürich", "CH");
        let debtor = QrAddress::new("Max Muster", "Hauptstrasse 5", "10115", "Berlin", "DE");
        let reference = Reference::for_number("CH4431999123000889012", 42);
        let bill = QrBill {
            iban: "CH4431999123000889012",
            creditor: &creditor,
            amount_cents: 194975,
            debtor: Some(&debtor),
            reference: &reference,
            message: "Rechnung 42",
        };
        let payload = bill.payload();
        let lines: Vec<&str> = payload.split('\n').collect();
        // Header 3, account 1, creditor 7, ultimate creditor 7, amount and
        // currency 2, debtor 7, reference 2, message 1, trailer 1.
        assert_eq!(lines.len(), 31);
        assert_eq!(&lines[..4], ["SPC", "0200", "1", "CH4431999123000889012"]);
        assert_eq!(&lines[4..11], ["S", "Muster AG", "Bahnhofstrasse", "1", "8000", "Zürich", "CH"]);
        assert_eq!(&lines[18..20], ["1949.75", "CHF"]);
        assert_eq!(&lines[20..27], ["S", "Max Muster", "Hauptstrasse", "5", "10115", "Berlin", "DE"]);
        assert_eq!(&lines[27..], ["QRR", reference.value(), "Rechnung 42", "EPD"]);
    }
}
