# Tiny Sales

A lightweight point-of-sale desktop app for small shops, built with Tauri, React and SQLite.

Tiny Sales is made for Switzerland: prices are in CHF, cash amounts are rounded to 5 Rappen, and it supports cash, TWINT and card payments as well as invoices with a QR payment part. It runs fully offline and keeps all data in a local SQLite database.

> **Note:** The user interface is currently available in German only.

## Features

- **Checkout:** add articles with a barcode/QR scanner or by search. Supports per-line and whole-sale discounts, works out the change for cash payments by note and coin, and prints receipts in A4 or A5.
- **Open sales:** leave a started sale open and serve another customer in between. Articles in open sales are reserved, and stock is deducted only when the sale is completed.
- **Customers and orders:** take orders for customers in advance, with a note per line (e.g. the name to print) and a production status (open, material to order, material ordered, ready for production, produced, delivered). Prices are fixed when a line is added. An order is billed at the checkout (cash, TWINT, card; also via **Auftrag abrechnen** in the checkout) or, when paid by invoice, by issuing an invoice. Billing books the sale, so it shows in the sales history and statistics and deducts the stock; orders don't reserve stock before that. A billed order stays open under **Aufträge** until it is delivered and paid, or fully returned.
- **Invoices:** a Swiss QR-bill on A4 with the QR payment part (QR reference for a QR-IBAN, creditor reference otherwise). The PDF is created once when the invoice is issued and stored in the database, so it can be opened or saved unchanged at any time later. **Rechnungen** lists the invoices with their status and marks overdue ones in the menu.
- **Reminders:** an overdue invoice gets a payment reminder, then a first and a second dunning letter, each with a new deadline and a QR payment part for what is still owed, stored as a PDF like the invoice. The next one is possible once the deadline has passed. Deadline and fee per dunning letter are set under **Einstellungen → Firma**; the payment reminder is free. Fees aren't booked as revenue.
- **Articles:** product groups and subgroups, an internal number (also printed on receipts), finishings that can be attached to other articles, promotions and stock levels.
- **Sales history:** every completed sale, including completed orders with their customer and invoice, with full or partial returns. A return is listed as its own entry with a negative total and the receipt number `R-<receipt number>`, so the list adds up to the net revenue. Receipt numbers have five digits (e.g. `00042`). Returns are refunded in cash, by TWINT, card or bank transfer.
- **Labels:** print QR code labels on configurable label sheets.
- **Statistics:** revenue by day, product group and article.
- **Settings:** company details and logo for receipts, backup and restore, a test mode with a separate database, and light and dark themes.
- **Updates:** the app updates itself from GitHub releases and backs up the database before its schema changes.

## Getting started

On first launch, open **Einstellungen → Firma** (Settings → Company). Enter your company name, address, VAT number and logo. These details are printed on receipts and stored in the database; the source code contains no company data. Prices are always entered including VAT: set the VAT rate there too, and receipts and invoices show the VAT contained in the total. A changed rate applies to sales and orders completed from then on; existing receipts and invoices keep theirs. For invoices, also enter the IBAN (or QR-IBAN) and the payment term, and write postal code and city as "8000 Zürich": the QR payment part needs them separately.

The database is stored in `%APPDATA%\ch.swen-loeffler.tinysales\` by default. You can choose a different location in the settings.

## Development

Prerequisites: [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

```sh
npm install
npm run tauri dev     # run the app in development mode
npm run tauri build   # build installers into src-tauri/target/release/bundle/
```

Run the backend tests:

```sh
cd src-tauri
cargo test
```

### Tech stack

- **Backend:** [Tauri 2](https://tauri.app/), Rust and SQLite via [sqlx](https://github.com/launchbadge/sqlx). The code is organised by feature (`src-tauri/src/features/*`, each with model, repository, service and commands).
- **Frontend:** React and TypeScript, TanStack Query, Router and Table, Tailwind CSS and [Base UI](https://base-ui.com/), with components structured by atomic design (`src/components/{atoms,molecules,organisms,templates}`).

### Database migrations

Migrations live in `src-tauri/migrations` and are applied automatically on startup, each in its own transaction. Before an existing database is migrated, a copy is written next to it (`tiny-sales-before-update-<timestamp>.db`). A database that was already migrated by a newer version of the app is refused rather than used. If the database can't be opened at startup, the app shows the reason instead of its pages and offers what can fix it: installing an update (e.g. when another computer already migrated the shared database), trying again (e.g. once the NAS is reachable), or opening or creating another database.

Rules for new migrations, so updates never break existing data:

- **Never edit a released migration.** sqlx refuses to start on a database whose recorded checksum differs, which would lock users out after the update. Add a new migration instead. The test `released_migrations_are_unchanged` enforces this without a list to maintain: it compares the migrations with every release tag (`v*`), so a migration counts as released as soon as the tag of its release exists. The test needs git and the tags (CI checks out with `fetch-depth: 0`).
- **Prefer additive changes:** new tables, new indexes, `ALTER TABLE … ADD COLUMN` with a `DEFAULT` (or nullable). Existing rows must stay valid.
- **Rebuilding a table** (SQLite can't drop constraints or change column types in place): foreign keys are enforced, so `DROP TABLE` deletes dependent rows through `ON DELETE CASCADE` (e.g. `open_sale` → `open_sale_item`). Start such a migration with `-- no-transaction`, then run `PRAGMA foreign_keys = OFF; BEGIN; …create new table, copy, drop, rename…; PRAGMA foreign_key_check; COMMIT; PRAGMA foreign_keys = ON;`.
- The test `data_of_the_first_release_survives_all_migrations` fills a database of the first release with data and checks that no rows are lost through all migrations. When a migration transforms data, extend it with a check for that.
- Migrations are always checked out with LF line endings (see `.gitattributes`), because the checksum covers the raw bytes.

## Releases and updates

Installed apps check GitHub for a new release at startup (and on demand under **Einstellungen → Updates**), then download, verify and install it, and restart.

One-time setup:

1. Generate the signing key pair (keep the private key and password safe; without them no further updates can be published):
   ```sh
   npx tauri signer generate -w ~/.tauri/tiny-sales.key
   ```
2. Put the content of `~/.tauri/tiny-sales.key.pub` into `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
3. Add the repository secrets `TAURI_SIGNING_PRIVATE_KEY` (content of `~/.tauri/tiny-sales.key`) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` under **Settings → Secrets and variables → Actions**.

### Branches

The project uses Gitflow: `main` holds released versions only, `develop` is the integration branch. Work happens on `feature/*` branches off `develop`, urgent fixes for a released version on `hotfix/*` branches off `main`. Only `develop` and `hotfix/*` may be merged into `main` (checked by `.github/workflows/pull-request-main.yml`).

CI (`.github/workflows/ci.yml`) runs for pushes to `feature/*`, `hotfix/*` and `develop`. A pull request shows the run of its last commit. Merging a pull request and pull requests into `main` run no tests again, because their commits were tested on their branch.

Publishing a release:

1. On `develop`, raise the version with `npm run version:patch`, `version:minor` or `version:major`. It updates `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`.
2. Push and merge `develop` into `main` (pull request).
3. Tag the merge commit on `main` and push the tag. From then on, the migrations of this release must not change (see above):
   ```sh
   git checkout main && git pull
   git tag v0.2.0 && git push origin v0.2.0
   ```
4. The workflow `.github/workflows/release.yml` checks that the tag is on `main` and matches the version, builds and signs the installer, and creates a draft release with `latest.json`. Check the draft and publish it. Only then do installed apps see the update.
5. Nothing to merge back: `.github/workflows/sync-develop.yml` moves `develop` forward to `main` after every merge into `main`, so the next pull request into `main` is up to date. If `develop` got commits of its own in the meantime, that workflow fails and `main` has to be merged into `develop` by hand (`git checkout develop && git pull && git merge main && git push`).

Hotfixes start with `git checkout -b hotfix/0.2.1 main`, bump the patch version, and are merged into `main`. If `develop` has moved on since the last release, merge `main` into `develop` by hand afterwards (see step 5).

Local release builds (`npm run tauri build`) also sign the updater artifacts, so set `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the environment first.

## License

Licensed under the [Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

Bundled libraries and fonts keep their own licenses; for example, the Montserrat font is licensed under the SIL Open Font License 1.1.
