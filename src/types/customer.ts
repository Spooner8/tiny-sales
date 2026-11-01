export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Männlich",
  female: "Weiblich",
};

/**
 * Countries offered for customer addresses (ISO 3166 codes). Any other
 * two-letter code is accepted by the backend too, so the list can grow.
 */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "CH", name: "Schweiz" },
  { code: "LI", name: "Liechtenstein" },
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "BE", name: "Belgien" },
  { code: "DK", name: "Dänemark" },
  { code: "ES", name: "Spanien" },
  { code: "FI", name: "Finnland" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "GR", name: "Griechenland" },
  { code: "HR", name: "Kroatien" },
  { code: "HU", name: "Ungarn" },
  { code: "IE", name: "Irland" },
  { code: "LU", name: "Luxemburg" },
  { code: "NL", name: "Niederlande" },
  { code: "NO", name: "Norwegen" },
  { code: "PL", name: "Polen" },
  { code: "PT", name: "Portugal" },
  { code: "SE", name: "Schweden" },
  { code: "SI", name: "Slowenien" },
  { code: "SK", name: "Slowakei" },
  { code: "CZ", name: "Tschechien" },
  { code: "US", name: "Vereinigte Staaten" },
];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  /** Street and house number in one line. */
  street: string | null;
  postalCode: string | null;
  city: string | null;
  /** ISO 3166 code, e.g. "CH" or "DE". */
  country: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  /** Used for the salutation on invoices. */
  gender: Gender | null;
  company: string | null;
  note: string | null;
  additionalInfo: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewCustomer = Omit<Customer, "id" | "active" | "createdAt" | "updatedAt">;

export interface UpdateCustomer extends NewCustomer {
  id: number;
  active: boolean;
}

/** e.g. "Bahnhofstrasse 1, 8000 Zürich" or "…, 10115 Berlin, Deutschland". */
export function customerAddressLine(customer: Customer): string {
  return [
    customer.street,
    [customer.postalCode, customer.city].filter(Boolean).join(" "),
    customer.country === "CH" ? null : countryName(customer.country),
  ]
    .filter(Boolean)
    .join(", ");
}

export function customerName(customer: Pick<Customer, "firstName" | "lastName">): string {
  return `${customer.firstName} ${customer.lastName}`;
}

/** On one line, the company always comes first: "Muster AG, Anna Muster". */
export function customerLabel(name: string, company: string | null): string {
  return company ? `${company}, ${name}` : name;
}
