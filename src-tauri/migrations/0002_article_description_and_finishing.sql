-- Articles get a free-text description (for a later feature) and a flag
-- marking them as a finishing; only finishings can be attached to other
-- articles as components. pattern_number stays as it is and is shown as
-- "Interne Nr." in the app.

ALTER TABLE article ADD COLUMN description TEXT;
ALTER TABLE article ADD COLUMN is_finishing INTEGER NOT NULL DEFAULT 0;

-- Articles already attached as a component are finishings, so existing
-- links stay valid and editable.
UPDATE article SET is_finishing = 1 WHERE id IN (SELECT component_article_id FROM article_component);
