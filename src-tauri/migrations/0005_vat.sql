-- VAT (MWST). Prices always include VAT; receipts and invoices show the VAT
-- contained in the total.

-- Rate for new sales in percent; 0 shows no VAT.
ALTER TABLE company_profile ADD COLUMN vat_rate_percent REAL NOT NULL DEFAULT 0;

-- Rate and contained VAT when the sale was booked, so a later change of the
-- rate never alters existing receipts and invoices. NULL for sales from
-- before VAT was recorded.
ALTER TABLE sale ADD COLUMN vat_rate_percent REAL;
ALTER TABLE sale ADD COLUMN vat_cents INTEGER;
