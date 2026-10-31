# Tiny Sales

A lightweight point-of-sale desktop app for small shops, built with Tauri, React and SQLite.

Tiny Sales is made for Switzerland: prices are in CHF, cash amounts are rounded to 5 Rappen, and it supports cash, TWINT and card payments. It runs fully offline and keeps all data in a local SQLite database.

> **Note:** The user interface is currently available in German only.

## Features

- **Checkout:** add articles with a barcode/QR scanner or by search. Supports per-line and whole-sale discounts, works out the change for cash payments by note and coin, and prints receipts in A4 or A5.
- **Open sales:** leave a started sale open and serve another customer in between. Articles in open sales are reserved, and stock is deducted only when the sale is completed.
- **Articles:** product groups and subgroups, components (e.g. finishings), promotions and stock levels.
- **Sales history:** every completed sale, with full or partial returns.
- **Labels:** print QR code labels on configurable label sheets.
- **Statistics:** revenue by day, product group and article.
- **Settings:** company details and logo for receipts, backup and restore, a test mode with a separate database, and light and dark themes.

## Getting started

On first launch, open **Einstellungen → Firma** (Settings → Company). Enter your company name, address, VAT number and logo. These details are printed on receipts and stored in the database; the source code contains no company data.

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

Database migrations live in `src-tauri/migrations` and are applied automatically on startup. Once a migration has been released, never edit it; add a new one instead.

## License

Licensed under the [Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

Bundled libraries and fonts keep their own licenses; for example, the Montserrat font is licensed under the SIL Open Font License 1.1.
