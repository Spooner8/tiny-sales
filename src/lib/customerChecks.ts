import { customerName } from "../types/customer";
import type { Customer } from "../types/customer";

// The checks of CustomerService, so the form shows problems right away.
// Keep both in sync; the backend stays authoritative.

/** Something like name@example.ch: one @, no spaces, a dot in the domain. */
export function isValidEmail(email: string): boolean {
  const at = email.indexOf("@");
  const domainParts = email.slice(at + 1).split(".");
  return (
    at > 0 &&
    !email.slice(at + 1).includes("@") &&
    !/\s/.test(email) &&
    domainParts.length >= 2 &&
    domainParts.every((part) => part !== "")
  );
}

/**
 * Swiss and international numbers as people write them, e.g.
 * "079 123 45 67", "+41 79 123 45 67", "044/123'45'67", "(044) 123-45-67":
 * digits with spaces, / ' - ( ), a leading + and 9 to 15 digits.
 */
export function isValidPhone(number: string): boolean {
  const rest = number.startsWith("+") ? number.slice(1) : number;
  const digits = rest.replace(/\D/g, "").length;
  return /^[\d /'()-]*$/.test(rest) && digits >= 9 && digits <= 15;
}

/**
 * Postal codes of the countries most customers come from; others are only
 * limited to what the QR payment part accepts.
 */
export function postalCodeError(country: string, code: string): string | null {
  const digits = (count: number) => new RegExp(`^\\d{${count}}$`).test(code);
  if (["CH", "LI", "AT"].includes(country)) return digits(4) ? null : `PLZ für ${country}: 4 Ziffern, z.B. 8000`;
  if (["DE", "FR", "IT"].includes(country)) return digits(5) ? null : `PLZ für ${country}: 5 Ziffern, z.B. 10115`;
  return code.length <= 16 ? null : "PLZ: höchstens 16 Zeichen";
}

/** Compared without case and extra spaces, so "anna  muster" is "Anna Muster". */
function normalize(value: string | null): string {
  return (value ?? "").trim().split(/\s+/).join(" ").toLowerCase();
}

/**
 * Another customer with the same first name, last name and additional info:
 * the additional info tells customers with the same name apart.
 */
export function findDuplicateCustomer(
  customers: Customer[],
  values: { firstName: string; lastName: string; additionalInfo: string | null },
  selfId: number | null,
): Customer | null {
  const key = [values.firstName, values.lastName, values.additionalInfo].map(normalize).join("\n");
  return (
    customers.find(
      (c) => c.id !== selfId && [c.firstName, c.lastName, c.additionalInfo].map(normalize).join("\n") === key,
    ) ?? null
  );
}

export function duplicateCustomerMessage(duplicate: Customer): string {
  const info = duplicate.additionalInfo ? `mit der Zusatzinfo «${duplicate.additionalInfo}»` : "ohne Zusatzinfo";
  const inactive = duplicate.active ? "" : ", deaktiviert";
  return (
    `Den Kunden «${customerName(duplicate)}» ${info} gibt es bereits (Kunden-Nr. ${duplicate.id}${inactive}). ` +
    "Für einen weiteren Kunden mit diesem Namen bitte eine abweichende Zusatzinfo erfassen."
  );
}
