-- Initial schema. Amounts are stored in Rappen (1/100 CHF) as integers.

CREATE TABLE product_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
);

-- Belongs to one product group; the name is unique within that group.
CREATE TABLE product_subgroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    product_group_id INTEGER REFERENCES product_group(id)
);

CREATE UNIQUE INDEX idx_product_subgroup_product_group_id_name ON product_subgroup(product_group_id, name);

CREATE TABLE article (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    -- Stored alongside the subgroup; the service keeps both consistent.
    product_group_id INTEGER NOT NULL REFERENCES product_group(id),
    product_subgroup_id INTEGER REFERENCES product_subgroup(id),
    pattern_number TEXT,
    -- Base price; the charged price adds the linked components.
    price_cents INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    -- Promotion in percent (0 = none).
    discount_percent REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    discontinued INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_article_product_group_id ON article(product_group_id);
CREATE INDEX idx_article_product_subgroup_id ON article(product_subgroup_id);

-- Articles that are part of another article, e.g. a finishing on a shirt,
-- with an optional price for this combination.
CREATE TABLE article_component (
    article_id INTEGER NOT NULL REFERENCES article(id),
    component_article_id INTEGER NOT NULL REFERENCES article(id),
    price_override_cents INTEGER,
    PRIMARY KEY (article_id, component_article_id),
    CHECK (article_id != component_article_id)
);

CREATE INDEX idx_article_component_component_article_id ON article_component(component_article_id);

CREATE TABLE sale (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 'Cash', 'Twint' or 'Card'.
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    -- Sum of all lines after promotions and line discounts.
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    -- Discount on the whole sale; total = subtotal - discount.
    discount_cents INTEGER NOT NULL DEFAULT 0,
    discount_percent REAL,
    -- 'percent', 'total' (a new final total was entered) or 'amount'.
    discount_kind TEXT,
    -- For percentage discounts: whether already discounted lines got it too.
    discount_cumulative INTEGER,
    total_cents INTEGER NOT NULL DEFAULT 0,
    pickup_number TEXT,
    cash_given_cents INTEGER,
    change_cents INTEGER
);

CREATE INDEX idx_sale_timestamp ON sale(timestamp);

CREATE TABLE sale_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sale(id),
    article_id INTEGER NOT NULL REFERENCES article(id),
    quantity INTEGER NOT NULL,
    -- Regular unit price before the promotion.
    list_price_cents INTEGER NOT NULL DEFAULT 0,
    -- Unit price charged, after the promotion and the line discount.
    unit_price_cents INTEGER NOT NULL,
    article_discount_percent REAL NOT NULL DEFAULT 0,
    -- 'percent' (value = percent) or 'price' (value = new unit price).
    line_discount_kind TEXT,
    line_discount_value REAL,
    -- This line's share of the sale discount.
    discount_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sale_item_sale_id ON sale_item(sale_id);
CREATE INDEX idx_sale_item_article_id ON sale_item(article_id);

CREATE TABLE sale_return (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sale(id),
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refund_method TEXT NOT NULL,
    total_refund_cents INTEGER NOT NULL
);

CREATE INDEX idx_sale_return_sale_id ON sale_return(sale_id);

CREATE TABLE sale_return_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_return_id INTEGER NOT NULL REFERENCES sale_return(id),
    article_id INTEGER NOT NULL REFERENCES article(id),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    -- Share of what was actually paid, after all discounts.
    refund_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sale_return_item_sale_return_id ON sale_return_item(sale_return_id);
CREATE INDEX idx_sale_return_item_article_id ON sale_return_item(article_id);

CREATE TABLE label_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    paper_size TEXT NOT NULL,
    -- 'portrait' or 'landscape'.
    orientation TEXT NOT NULL DEFAULT 'portrait',
    columns INTEGER NOT NULL,
    rows INTEGER NOT NULL,
    label_width_mm REAL NOT NULL,
    label_height_mm REAL NOT NULL,
    gap_x_mm REAL NOT NULL,
    gap_y_mm REAL NOT NULL,
    margin_x_mm REAL NOT NULL,
    margin_y_mm REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

-- Sales started at the checkout but not completed yet. They only reserve
-- stock: it is deducted when the sale is completed, which also deletes the
-- open sale. Discounts are stored as typed (drafts).
CREATE TABLE open_sale (
    -- Generated by the frontend (UUID), so a new open sale is usable at once.
    id TEXT PRIMARY KEY NOT NULL,
    -- Tab number at the checkout, reused once the sale is closed.
    number INTEGER NOT NULL,
    label TEXT,
    -- Sale discount draft: 'none', 'percent' or 'total'.
    discount_kind TEXT NOT NULL DEFAULT 'none',
    discount_input TEXT NOT NULL DEFAULT '',
    discount_cumulative INTEGER NOT NULL DEFAULT 0,
    pickup_number TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE open_sale_item (
    open_sale_id TEXT NOT NULL REFERENCES open_sale(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES article(id),
    -- Order of the lines in the cart.
    position INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    -- Line discount draft: 'none', 'percent' or 'price'.
    discount_kind TEXT NOT NULL DEFAULT 'none',
    discount_input TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (open_sale_id, article_id)
);

CREATE INDEX idx_open_sale_item_article ON open_sale_item(article_id);

-- The shop's own details for receipts and the menu. Exactly one row.
CREATE TABLE company_profile (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    street TEXT NOT NULL DEFAULT '',
    -- Postal code and city in one line.
    postal_city TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    vat_number TEXT NOT NULL DEFAULT '',
    receipt_thanks TEXT NOT NULL DEFAULT '',
    receipt_signature TEXT NOT NULL DEFAULT '',
    -- Images as data URLs: the logo for receipt and menu, and an optional
    -- square mark for the collapsed menu.
    logo TEXT,
    logo_mark TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO company_profile (id) VALUES (1);
