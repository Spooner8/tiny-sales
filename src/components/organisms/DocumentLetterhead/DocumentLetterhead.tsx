import { countryName } from "../../../types/customer";
import type { CompanyProfile } from "../../../types/companyProfile";
import type { Customer } from "../../../types/customer";

export interface DocumentLetterheadProps {
  company: CompanyProfile;
  customer: Customer;
}

function recipientName(customer: Customer): string {
  const title = customer.gender === "male" ? "Herr " : customer.gender === "female" ? "Frau " : "";
  return `${title}${customer.firstName} ${customer.lastName}`;
}

/** Top of invoices and reminders: the shop's details and the customer's address. */
export function DocumentLetterhead({ company, customer }: DocumentLetterheadProps) {
  const senderLine = [company.name, company.street, company.postalCity].filter(Boolean).join(" · ");
  return (
    <>
      <header className="invoice-header">
        {company.logo ? <img className="invoice-logo" src={company.logo} alt={company.name} /> : <span />}
        <address className="invoice-company">
          <strong>{company.name}</strong>
          {company.street && <span>{company.street}</span>}
          {company.postalCity && <span>{company.postalCity}</span>}
          {company.phone && <span>{company.phone}</span>}
          {company.website && <span>{company.website}</span>}
        </address>
      </header>

      <address className="invoice-recipient">
        <span className="invoice-sender-line">{senderLine}</span>
        {customer.company && <span>{customer.company}</span>}
        <span>{recipientName(customer)}</span>
        {customer.street && <span>{customer.street}</span>}
        {(customer.postalCode || customer.city) && (
          <span>{[customer.postalCode, customer.city].filter(Boolean).join(" ")}</span>
        )}
        {/* Abroad, the country goes on the last line in capitals, as the post wants it. */}
        {customer.country !== "CH" && <span>{countryName(customer.country).toUpperCase()}</span>}
      </address>
    </>
  );
}
