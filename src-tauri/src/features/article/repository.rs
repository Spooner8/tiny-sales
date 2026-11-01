use std::collections::HashMap;

use sqlx::{FromRow, SqlitePool};

use crate::error::AppError;
use crate::money;

use super::model::{
    Article, ArticleComponentDetail, NewArticle, NewArticleComponentLink, UpdateArticle,
};

#[derive(FromRow)]
struct ArticleRow {
    id: i64,
    code: String,
    name: String,
    product_group_id: i64,
    product_subgroup_id: i64,
    internal_number: Option<String>,
    description: Option<String>,
    is_finishing: bool,
    price_cents: i64,
    stock: i64,
    active: bool,
    discontinued: bool,
    discount_percent: f64,
    created_at: String,
    updated_at: String,
}

#[derive(FromRow)]
struct ArticleComponentRow {
    article_id: i64,
    component_article_id: i64,
    code: String,
    name: String,
    internal_number: Option<String>,
    price_cents: i64,
}

impl ArticleRow {
    fn into_domain(self, components: Vec<ArticleComponentDetail>) -> Article {
        let components_total: i64 = components.iter().map(|c| c.price_cents).sum();
        let total_price_cents = self.price_cents + components_total;
        Article {
            id: self.id,
            code: self.code,
            name: self.name,
            product_group_id: self.product_group_id,
            product_subgroup_id: self.product_subgroup_id,
            internal_number: self.internal_number,
            description: self.description,
            is_finishing: self.is_finishing,
            price_cents: self.price_cents,
            stock: self.stock,
            active: self.active,
            discontinued: self.discontinued,
            created_at: self.created_at,
            updated_at: self.updated_at,
            total_price_cents,
            discount_percent: self.discount_percent,
            sale_price_cents: money::apply_percent_discount(total_price_cents, self.discount_percent),
            components,
        }
    }
}

const SELECT_FIELDS: &str =
    "id, code, name, product_group_id, product_subgroup_id, internal_number, description, is_finishing, price_cents, stock, active, discontinued, discount_percent, created_at, updated_at";

pub struct ArticleRepository;

impl ArticleRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<Article>, AppError> {
        let rows = sqlx::query_as::<_, ArticleRow>(&format!(
            "SELECT {SELECT_FIELDS} FROM article ORDER BY name"
        ))
        .fetch_all(pool)
        .await?;

        let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
        let mut components_by_article = Self::components_for(pool, &ids).await?;

        Ok(rows
            .into_iter()
            .map(|row| {
                let components = components_by_article.remove(&row.id).unwrap_or_default();
                row.into_domain(components)
            })
            .collect())
    }

    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<Article>, AppError> {
        let row = sqlx::query_as::<_, ArticleRow>(&format!(
            "SELECT {SELECT_FIELDS} FROM article WHERE id = ?"
        ))
        .bind(id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(row) => {
                let mut components_by_article = Self::components_for(pool, &[row.id]).await?;
                let components = components_by_article.remove(&row.id).unwrap_or_default();
                Ok(Some(row.into_domain(components)))
            }
            None => Ok(None),
        }
    }

    async fn components_for(
        pool: &SqlitePool,
        article_ids: &[i64],
    ) -> Result<HashMap<i64, Vec<ArticleComponentDetail>>, AppError> {
        if article_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let placeholders = article_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        let query = format!(
            "SELECT article_component.article_id as article_id,
                    article_component.component_article_id as component_article_id,
                    article.code as code, article.name as name, article.internal_number as internal_number,
                    COALESCE(article_component.price_override_cents, article.price_cents) as price_cents
             FROM article_component
             JOIN article ON article_component.component_article_id = article.id
             WHERE article_component.article_id IN ({placeholders})
             ORDER BY article.name"
        );
        let mut q = sqlx::query_as::<_, ArticleComponentRow>(&query);
        for id in article_ids {
            q = q.bind(id);
        }
        let rows = q.fetch_all(pool).await?;

        let mut grouped: HashMap<i64, Vec<ArticleComponentDetail>> = HashMap::new();
        for row in rows {
            grouped.entry(row.article_id).or_default().push(ArticleComponentDetail {
                component_article_id: row.component_article_id,
                code: row.code,
                name: row.name,
                internal_number: row.internal_number,
                price_cents: row.price_cents,
            });
        }
        Ok(grouped)
    }

    async fn replace_component_links(
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
        article_id: i64,
        links: &[NewArticleComponentLink],
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM article_component WHERE article_id = ?")
            .bind(article_id)
            .execute(&mut **tx)
            .await?;

        for link in links {
            sqlx::query(
                "INSERT INTO article_component (article_id, component_article_id, price_override_cents) VALUES (?, ?, ?)",
            )
            .bind(article_id)
            .bind(link.component_article_id)
            .bind(link.price_override_cents)
            .execute(&mut **tx)
            .await?;
        }
        Ok(())
    }

    /// How many articles have this one attached as a component.
    pub async fn count_component_uses(pool: &SqlitePool, id: i64) -> Result<i64, AppError> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM article_component WHERE component_article_id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;
        Ok(count)
    }

    pub async fn code_exists(pool: &SqlitePool, code: &str) -> Result<bool, AppError> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM article WHERE code = ?")
            .bind(code)
            .fetch_one(pool)
            .await?;
        Ok(count > 0)
    }

    pub async fn create(
        pool: &SqlitePool,
        code: &str,
        input: &NewArticle,
    ) -> Result<Article, AppError> {
        let mut tx = pool.begin().await?;

        let id = sqlx::query(
            "INSERT INTO article (code, name, product_group_id, product_subgroup_id, internal_number, description, is_finishing, price_cents, stock, active, discontinued, discount_percent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        )
        .bind(code)
        .bind(&input.name)
        .bind(input.product_group_id)
        .bind(input.product_subgroup_id)
        .bind(&input.internal_number)
        .bind(&input.description)
        .bind(input.is_finishing)
        .bind(input.price_cents)
        .bind(input.stock)
        .bind(input.discontinued)
        .bind(input.discount_percent)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        Self::replace_component_links(&mut tx, id, &input.component_links).await?;
        tx.commit().await?;

        Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Artikel {id} nach dem Anlegen nicht gefunden")))
    }

    pub async fn update(pool: &SqlitePool, input: &UpdateArticle) -> Result<Article, AppError> {
        let mut tx = pool.begin().await?;

        sqlx::query(
            "UPDATE article
             SET name = ?, product_group_id = ?, product_subgroup_id = ?, internal_number = ?, description = ?, is_finishing = ?, price_cents = ?, stock = ?, active = ?, discontinued = ?, discount_percent = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
        )
        .bind(&input.name)
        .bind(input.product_group_id)
        .bind(input.product_subgroup_id)
        .bind(&input.internal_number)
        .bind(&input.description)
        .bind(input.is_finishing)
        .bind(input.price_cents)
        .bind(input.stock)
        .bind(input.active)
        .bind(input.discontinued)
        .bind(input.discount_percent)
        .bind(input.id)
        .execute(&mut *tx)
        .await?;

        Self::replace_component_links(&mut tx, input.id, &input.component_links).await?;
        tx.commit().await?;

        Self::find_by_id(pool, input.id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Artikel {} nicht gefunden", input.id)))
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        sqlx::query("UPDATE article SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
