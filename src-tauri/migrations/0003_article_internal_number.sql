-- The pattern number becomes the internal number ("Interne Nr."): copied
-- into a new column, then the old one is dropped. It has no index or
-- constraint, so SQLite can drop it in place.

ALTER TABLE article ADD COLUMN internal_number TEXT;
UPDATE article SET internal_number = pattern_number;
ALTER TABLE article DROP COLUMN pattern_number;
