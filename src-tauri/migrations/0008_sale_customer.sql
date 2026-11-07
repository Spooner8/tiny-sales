-- A customer assigned to a sale afterwards. Sales of a customer order leave
-- this empty: their customer is the order's.
ALTER TABLE sale ADD COLUMN customer_id INTEGER REFERENCES customer(id);

CREATE INDEX idx_sale_customer_id ON sale(customer_id);
