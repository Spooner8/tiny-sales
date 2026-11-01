-- Customers can live abroad: their country (ISO 3166 code, e.g. 'DE') is
-- needed for the address on invoices and in the QR payment part.
ALTER TABLE customer ADD COLUMN country TEXT NOT NULL DEFAULT 'CH';
