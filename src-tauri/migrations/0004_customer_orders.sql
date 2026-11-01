-- Customers and their orders. An order is taken in advance, goes through
-- its production states and is completed later: at the checkout, or - for
-- payment by invoice - by creating an invoice. Completing books a sale.

CREATE TABLE customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    -- Street and house number in one line.
    street TEXT,
    postal_code TEXT,
    city TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    -- 'male', 'female' or NULL; used for the salutation on invoices.
    gender TEXT,
    company TEXT,
    note TEXT,
    additional_info TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_order (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customer(id),
    -- 'open', 'material_required', 'material_ordered', 'ready_for_production',
    -- 'produced' or 'delivered'.
    status TEXT NOT NULL DEFAULT 'open',
    -- 'Cash', 'Twint', 'Card' or 'Invoice'. Only an invoice is completed
    -- without the checkout.
    payment_method TEXT NOT NULL,
    -- Discount on the whole order, as on a sale: 'percent' (value = percent,
    -- cumulative as at the checkout) or 'total' (value = new total in Rappen).
    discount_kind TEXT,
    discount_value REAL,
    discount_cumulative INTEGER NOT NULL DEFAULT 0,
    -- The sale the order was completed with; its items are fixed from then on.
    sale_id INTEGER UNIQUE REFERENCES sale(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_order_customer_id ON customer_order(customer_id);

-- Unlike open sales, an article can appear on several lines, e.g. with a
-- different note each. Orders don't reserve stock; it is deducted when the
-- order is completed.
CREATE TABLE customer_order_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_order_id INTEGER NOT NULL REFERENCES customer_order(id) ON DELETE CASCADE,
    -- Order of the lines in the order.
    position INTEGER NOT NULL,
    article_id INTEGER NOT NULL REFERENCES article(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    -- Prices when the line was added: the customer pays what was agreed,
    -- even if the article's price changes before the order is completed.
    list_price_cents INTEGER NOT NULL,
    sale_price_cents INTEGER NOT NULL,
    article_discount_percent REAL NOT NULL DEFAULT 0,
    -- 'percent' (value = percent) or 'price' (value = new unit price).
    line_discount_kind TEXT,
    line_discount_value REAL,
    -- Extra information for this line only, e.g. the text to print.
    note TEXT
);

CREATE INDEX idx_customer_order_item_order_id ON customer_order_item(customer_order_id);
CREATE INDEX idx_customer_order_item_article_id ON customer_order_item(article_id);

-- The note of the order line, kept with the sale for receipts and invoices.
ALTER TABLE sale_item ADD COLUMN note TEXT;

-- Invoice for a sale paid by invoice; its id is the invoice number.
CREATE TABLE invoice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL UNIQUE REFERENCES sale(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 'YYYY-MM-DD'.
    due_date TEXT NOT NULL,
    -- Day the payment arrived ('YYYY-MM-DD'); NULL while it is open.
    paid_on TEXT,
    -- The PDF as issued. Written once, right after the invoice is created,
    -- so it can be opened again unchanged later.
    pdf BLOB
);

-- Account for the QR payment part of invoices (IBAN or QR-IBAN) and the
-- payment term in days.
ALTER TABLE company_profile ADD COLUMN iban TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN invoice_payment_days INTEGER NOT NULL DEFAULT 30;
