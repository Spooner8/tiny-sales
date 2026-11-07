use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::features::product_subgroup::repository::ProductSubgroupRepository;
use crate::features::product_group::repository::ProductGroupRepository;

use super::model::{Article, NewArticle, NewArticleComponentLink, UpdateArticle};
use super::repository::ArticleRepository;

/// Business rules for articles: validation, generating a unique scan
/// code, and making sure the referenced product group / subgroup /
/// component articles exist and fit together (components must be marked
/// as finishings).
pub struct ArticleService;

impl ArticleService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<Article>, AppError> {
        ArticleRepository::list(pool).await
    }

    pub async fn create(pool: &SqlitePool, input: NewArticle) -> Result<Article, AppError> {
        Self::validate(
            pool,
            &input.name,
            input.product_group_id,
            input.product_subgroup_id,
            input.price_cents,
            input.stock,
            input.discount_percent,
            None,
            &input.component_links,
        )
        .await?;
        let code = Self::generate_unique_code(pool).await?;
        ArticleRepository::create(pool, &code, &input).await
    }

    pub async fn update(pool: &SqlitePool, input: UpdateArticle) -> Result<Article, AppError> {
        Self::validate(
            pool,
            &input.name,
            input.product_group_id,
            input.product_subgroup_id,
            input.price_cents,
            input.stock,
            input.discount_percent,
            Some(input.id),
            &input.component_links,
        )
        .await?;
        // Unmarking would leave links to an article that can no longer be
        // picked as a finishing, and those articles could not be saved.
        if !input.is_finishing {
            let uses = ArticleRepository::count_component_uses(pool, input.id).await?;
            if uses > 0 {
                return Err(AppError::Validation(format!(
                    "Veredelung kann nicht entfernt werden: {uses} Artikel verwenden diesen Artikel noch als Veredelung"
                )));
            }
        }
        ArticleRepository::update(pool, &input).await
    }

    pub async fn deactivate(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        ArticleRepository::deactivate(pool, id).await
    }

    async fn validate(
        pool: &SqlitePool,
        name: &str,
        product_group_id: i64,
        product_subgroup_id: i64,
        price_cents: i64,
        stock: i64,
        discount_percent: f64,
        self_id: Option<i64>,
        component_links: &[NewArticleComponentLink],
    ) -> Result<(), AppError> {
        if name.trim().is_empty() {
            return Err(AppError::Validation("Name darf nicht leer sein".into()));
        }
        if price_cents < 0 {
            return Err(AppError::Validation("Preis darf nicht negativ sein".into()));
        }
        if !(0.0..=100.0).contains(&discount_percent) {
            return Err(AppError::Validation("Rabatt muss zwischen 0 und 100 % liegen".into()));
        }
        if stock < 0 {
            return Err(AppError::Validation("Bestand darf nicht negativ sein".into()));
        }
        if ProductGroupRepository::find_by_id(pool, product_group_id)
            .await?
            .is_none()
        {
            return Err(AppError::Validation("Warengruppe existiert nicht".into()));
        }
        match ProductSubgroupRepository::find_by_id(pool, product_subgroup_id).await? {
            None => return Err(AppError::Validation("Warenuntergruppe existiert nicht".into())),
            Some(subgroup) if subgroup.product_group_id != product_group_id => {
                return Err(AppError::Validation(
                    "Warenuntergruppe gehört nicht zur gewählten Warengruppe".into(),
                ));
            }
            Some(_) => {}
        }
        for link in component_links {
            if let Some(price) = link.price_override_cents {
                if price < 0 {
                    return Err(AppError::Validation(
                        "Veredelungspreis darf nicht negativ sein".into(),
                    ));
                }
            }
            if Some(link.component_article_id) == self_id {
                return Err(AppError::Validation(
                    "Ein Artikel kann nicht sich selbst als Veredelung referenzieren".into(),
                ));
            }
            match ArticleRepository::find_by_id(pool, link.component_article_id).await? {
                None => return Err(AppError::Validation("Referenzierter Artikel existiert nicht".into())),
                Some(component) if !component.is_finishing => {
                    return Err(AppError::Validation(format!(
                        "\"{}\" ist nicht als Veredelung markiert",
                        component.name
                    )));
                }
                Some(_) => {}
            }
        }
        Ok(())
    }

    async fn generate_unique_code(pool: &SqlitePool) -> Result<String, AppError> {
        for _ in 0..5 {
            let candidate = random_code();
            if !ArticleRepository::code_exists(pool, &candidate).await? {
                return Ok(candidate);
            }
        }
        Err(AppError::Validation(
            "Konnte keine eindeutige Artikelnummer generieren".into(),
        ))
    }
}

/// A random 6-character article number, e.g. "K7Q2XM" (~730 million
/// possibilities, plenty for a small shop). Leaves out characters that are
/// easily confused when typed by hand (0/O, 1/I) and Y/Z, which a scanner
/// emulating a US keyboard swaps on a Swiss keyboard layout.
pub fn random_code() -> String {
    const ALPHABET: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWX";
    const CODE_LENGTH: usize = 6;
    // Largest multiple of the alphabet size up to 256: bytes at or above it
    // are skipped so `byte % len` stays uniform.
    let limit = 256 / ALPHABET.len() * ALPHABET.len();
    let mut code = String::with_capacity(CODE_LENGTH);
    while code.len() < CODE_LENGTH {
        for byte in Uuid::new_v4().as_bytes() {
            if (*byte as usize) < limit && code.len() < CODE_LENGTH {
                code.push(ALPHABET[*byte as usize % ALPHABET.len()] as char);
            }
        }
    }
    code
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_code_is_six_unambiguous_characters() {
        for _ in 0..1000 {
            let code = random_code();
            assert_eq!(code.len(), 6);
            assert!(code.chars().all(|c| !"01OIYZ".contains(c) && (c.is_ascii_digit() || c.is_ascii_uppercase())));
        }
    }
}
