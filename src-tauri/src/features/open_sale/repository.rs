use std::collections::HashMap;

use sqlx::{FromRow, Sqlite, SqlitePool, Transaction};

use crate::error::AppError;

use super::model::{LineDiscountDraft, OpenSale, OpenSaleItem, SaleDiscountDraft, SaveOpenSale};

#[derive(FromRow)]
struct OpenSaleRow {
    id: String,
    number: i64,
    label: Option<String>,
    discount_kind: String,
    discount_input: String,
    discount_cumulative: bool,
    pickup_number: String,
    created_at: String,
    updated_at: String,
}

#[derive(FromRow)]
struct OpenSaleItemRow {
    open_sale_id: String,
    article_id: i64,
    quantity: i64,
    discount_kind: String,
    discount_input: String,
}

pub struct OpenSaleRepository;

impl OpenSaleRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<OpenSale>, AppError> {
        let rows = sqlx::query_as::<_, OpenSaleRow>(
            "SELECT id, number, label, discount_kind, discount_input, discount_cumulative, pickup_number, created_at, updated_at
             FROM open_sale ORDER BY number, created_at",
        )
        .fetch_all(pool)
        .await?;

        let item_rows = sqlx::query_as::<_, OpenSaleItemRow>(
            "SELECT open_sale_id, article_id, quantity, discount_kind, discount_input
             FROM open_sale_item ORDER BY open_sale_id, position",
        )
        .fetch_all(pool)
        .await?;

        let mut items_by_sale: HashMap<String, Vec<OpenSaleItem>> = HashMap::new();
        for row in item_rows {
            items_by_sale.entry(row.open_sale_id).or_default().push(OpenSaleItem {
                article_id: row.article_id,
                quantity: row.quantity,
                discount: LineDiscountDraft { kind: row.discount_kind, input: row.discount_input },
            });
        }

        Ok(rows
            .into_iter()
            .map(|row| OpenSale {
                items: items_by_sale.remove(&row.id).unwrap_or_default(),
                id: row.id,
                number: row.number,
                label: row.label,
                discount: SaleDiscountDraft {
                    kind: row.discount_kind,
                    input: row.discount_input,
                    cumulative: row.discount_cumulative,
                },
                pickup_number: row.pickup_number,
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
            .collect())
    }

    /// Inserts the open sale or replaces its stored state and items.
    pub async fn save(pool: &SqlitePool, input: &SaveOpenSale) -> Result<(), AppError> {
        let mut tx = pool.begin().await?;

        sqlx::query(
            "INSERT INTO open_sale (id, number, label, discount_kind, discount_input, discount_cumulative, pickup_number)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                number = excluded.number,
                label = excluded.label,
                discount_kind = excluded.discount_kind,
                discount_input = excluded.discount_input,
                discount_cumulative = excluded.discount_cumulative,
                pickup_number = excluded.pickup_number,
                updated_at = CURRENT_TIMESTAMP",
        )
        .bind(&input.id)
        .bind(input.number)
        .bind(&input.label)
        .bind(&input.discount.kind)
        .bind(&input.discount.input)
        .bind(input.discount.cumulative)
        .bind(&input.pickup_number)
        .execute(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM open_sale_item WHERE open_sale_id = ?")
            .bind(&input.id)
            .execute(&mut *tx)
            .await?;

        for (position, item) in input.items.iter().enumerate() {
            sqlx::query(
                "INSERT INTO open_sale_item (open_sale_id, article_id, position, quantity, discount_kind, discount_input)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(&input.id)
            .bind(item.article_id)
            .bind(position as i64)
            .bind(item.quantity)
            .bind(&item.discount.kind)
            .bind(&item.discount.input)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        let mut tx = pool.begin().await?;
        Self::delete_in(&mut tx, id).await?;
        tx.commit().await?;
        Ok(())
    }

    /// Deletes the open sale inside a running transaction, e.g. together with
    /// completing it. A missing open sale is not an error.
    pub async fn delete_in(tx: &mut Transaction<'_, Sqlite>, id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM open_sale_item WHERE open_sale_id = ?")
            .bind(id)
            .execute(&mut **tx)
            .await?;
        sqlx::query("DELETE FROM open_sale WHERE id = ?")
            .bind(id)
            .execute(&mut **tx)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    use super::*;
    use crate::features::sale::model::{NewSale, NewSaleItem, PaymentMethod};
    use crate::features::sale::service::SaleService;

    async fn pool_with_article(stock: i64) -> (SqlitePool, i64) {
        let pool = SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        let group_id = sqlx::query("INSERT INTO product_group (name) VALUES ('Group')")
            .execute(&pool)
            .await
            .unwrap()
            .last_insert_rowid();
        let subgroup_id = sqlx::query("INSERT INTO product_subgroup (name, product_group_id) VALUES ('Subgroup', ?)")
            .bind(group_id)
            .execute(&pool)
            .await
            .unwrap()
            .last_insert_rowid();
        let article_id = sqlx::query(
            "INSERT INTO article (code, name, product_group_id, product_subgroup_id, price_cents, stock, active, discontinued, discount_percent)
             VALUES ('T1', 'Test', ?, ?, 1000, ?, 1, 0, 0)",
        )
        .bind(group_id)
        .bind(subgroup_id)
        .bind(stock)
        .execute(&pool)
        .await
        .unwrap()
        .last_insert_rowid();
        (pool, article_id)
    }

    fn open_sale(id: &str, article_id: i64, quantity: i64) -> SaveOpenSale {
        SaveOpenSale {
            id: id.into(),
            number: 1,
            label: Some("Customer".into()),
            discount: SaleDiscountDraft { kind: "percent".into(), input: "10".into(), cumulative: false },
            pickup_number: String::new(),
            items: vec![OpenSaleItem {
                article_id,
                quantity,
                discount: LineDiscountDraft { kind: "none".into(), input: String::new() },
            }],
        }
    }

    async fn stock(pool: &SqlitePool, article_id: i64) -> i64 {
        sqlx::query_scalar("SELECT stock FROM article WHERE id = ?").bind(article_id).fetch_one(pool).await.unwrap()
    }

    #[test]
    fn open_sale_reserves_without_booking_until_completed() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let (pool, article_id) = pool_with_article(5).await;

            OpenSaleRepository::save(&pool, &open_sale("a", article_id, 1)).await.unwrap();
            // Saving again replaces the items instead of adding to them.
            OpenSaleRepository::save(&pool, &open_sale("a", article_id, 2)).await.unwrap();
            let sales = OpenSaleRepository::list(&pool).await.unwrap();
            assert_eq!(sales.len(), 1);
            assert_eq!(sales[0].items.len(), 1);
            assert_eq!(sales[0].items[0].quantity, 2);
            assert_eq!(sales[0].discount.input, "10");
            assert_eq!(stock(&pool, article_id).await, 5);

            SaleService::create(
                &pool,
                NewSale {
                    items: vec![NewSaleItem { article_id, quantity: 2, discount: None }],
                    payment_method: PaymentMethod::Card,
                    cash_given_cents: None,
                    pickup_number: None,
                    discount: None,
                    open_sale_id: Some("a".into()),
                },
            )
            .await
            .unwrap();

            assert!(OpenSaleRepository::list(&pool).await.unwrap().is_empty());
            assert_eq!(stock(&pool, article_id).await, 3);
        });
    }

    #[test]
    fn deleting_an_open_sale_books_nothing() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let (pool, article_id) = pool_with_article(5).await;
            OpenSaleRepository::save(&pool, &open_sale("a", article_id, 3)).await.unwrap();
            OpenSaleRepository::delete(&pool, "a").await.unwrap();
            assert!(OpenSaleRepository::list(&pool).await.unwrap().is_empty());
            let items: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM open_sale_item").fetch_one(&pool).await.unwrap();
            assert_eq!(items, 0);
            assert_eq!(stock(&pool, article_id).await, 5);
        });
    }
}
