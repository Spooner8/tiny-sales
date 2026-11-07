-- Reminders for overdue invoices. Level 1 is the payment reminder
-- ("Zahlungserinnerung"), 2 and 3 are the first and second dunning letter.
CREATE TABLE invoice_reminder (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoice(id),
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The new payment deadline ('YYYY-MM-DD').
    due_date TEXT NOT NULL,
    -- The fee added by this reminder.
    fee_cents INTEGER NOT NULL DEFAULT 0,
    -- What the customer was asked to pay, including all fees so far.
    amount_cents INTEGER NOT NULL,
    -- The PDF as issued, written once like the invoice's.
    pdf BLOB,
    UNIQUE (invoice_id, level)
);

-- Payment term of reminders in days and the fee per dunning letter; the
-- payment reminder itself is free.
ALTER TABLE company_profile ADD COLUMN reminder_payment_days INTEGER NOT NULL DEFAULT 10;
ALTER TABLE company_profile ADD COLUMN reminder_fee_cents INTEGER NOT NULL DEFAULT 0;
