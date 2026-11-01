# AGENTS.md

Instructions for AI coding agents working on Tiny Sales. The [README](README.md) describes the project for humans; this file adds the rules an agent must follow. If the two disagree, ask the maintainer instead of guessing.

## Project at a glance

Tiny Sales is an offline point-of-sale desktop app for small Swiss shops: Tauri 2 (Rust) backend with SQLite (sqlx), React 19 + TypeScript frontend. Windows only (NSIS installer), self-updating from GitHub releases. Public repository: `Spooner8/tiny-sales`, Apache-2.0.

- Current version: see `version` in `package.json` (kept identical in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`).
- Released versions are the `v*` tags (`git tag --list "v*"`); a migration is released once it is contained in one of them.
- The production database may live on a NAS and be shared by several computers running the app.

## Commands

```sh
npm install
npm run tauri dev                                # run the app
npm run build                                    # type check (tsc) + frontend build
cargo test --manifest-path src-tauri/Cargo.toml  # backend tests
```

Before declaring work done, run `npm run build` and `cargo test` - this is exactly what CI runs. There are no frontend tests and no linter configured.

## Code layout and conventions

**Backend (`src-tauri/src`)** - organised by feature, `features/<name>/` with:

- `model.rs` - serde/sqlx structs (`Foo`, `NewFoo`, `UpdateFoo`)
- `repository.rs` - SQL only, no business rules
- `service.rs` - validation and business rules
- `commands.rs` - thin `#[tauri::command]` layer, delegates to the service

Every new command must be registered in `generate_handler!` in `src-tauri/src/lib.rs`. Errors go through `AppError` (`error.rs`); its messages reach the user, so they are in **German**. New plugin permissions go into `src-tauri/capabilities/default.json`.

**Frontend (`src`)**:

- `lib/api/<feature>.ts` - wrappers around `invokeCommand` (`lib/api/client.ts`), never call `invoke` directly
- `types/<feature>.ts` - TypeScript mirrors of the Rust models (keep field names in sync)
- `hooks/use<Feature>.ts` - TanStack Query queries/mutations, invalidate the query key on success
- `components/{atoms,molecules,organisms,templates}` - atomic design; `components/ui` holds the low-level Base UI primitives that atoms re-export
- `pages/` - one page per route, routes in `router.tsx`

**Money:** all amounts are integer Rappen. Cash is rounded to 5 Rappen. `src-tauri/src/money.rs` and `src/lib/money/discount.ts` implement the same rules - change both together.

**Language:** UI texts and user-facing error messages in German; code, identifiers, comments, commit messages and docs in English.

**Style:** match the surrounding code. Comments explain *why*, not what. Keep the README up to date when behaviour, setup, workflows or release steps change.

## Database migrations

Read the "Database migrations" section of the README before touching the schema. In short:

- Never edit, rename or delete a migration contained in a release tag (`v*`). Add a new one. The test `released_migrations_are_unchanged` checks this against the tags.
- Prefer additive changes (new tables/indexes, `ADD COLUMN` with `DEFAULT` or nullable).
- Table rebuilds need `-- no-transaction` and the `PRAGMA foreign_keys` sequence from the README, otherwise `ON DELETE CASCADE` deletes data.
- When a migration transforms data, extend the test `data_of_the_first_release_survives_all_migrations`.
- `.sql` files must stay LF (enforced by `.gitattributes`).
- **Always tell the maintainer when a change adds a migration.** An app that sees a database migrated by a newer version refuses it, so with a shared NAS database every computer has to be updated at the same time.

## Breaking changes - warn first, the maintainer decides the version

Do **not** implement a breaking change on your own. Stop *before* writing it and tell the maintainer:

1. what exactly breaks and who is affected (existing databases, installed apps, other computers on a shared database, backups),
2. whether a non-breaking alternative exists, and what it costs,
3. which version bump you would suggest (patch / minor / major) and why.

Then wait. The maintainer decides whether the change happens and which version comes next. Never run `npm run version:*` or change version numbers unless asked to.

In this project a change is breaking if, for example, it:

- changes or removes existing data in a migration (anything that isn't purely additive), or makes existing rows invalid,
- makes databases, backups or the config file of an older version unusable, or files written by the new version unreadable for users who stay on an older one longer than a normal update would,
- changes the app `identifier` (moves the data directory), the updater `pubkey`, the updater `endpoints` or the bundle format - installed apps could stop updating,
- removes or substantially changes an existing feature or workflow that users rely on (checkout, payments, receipts, returns, labels, backup/restore),
- changes how amounts are calculated or rounded in a way that alters existing sales, returns or statistics.

Changes between the Rust commands and the frontend are internal (both ship together) and are not breaking by themselves.

When an approved breaking change is committed, mark it as such: `feat!: …` or a `BREAKING CHANGE: …` footer, and say so in the pull request description.

## Branching (Gitflow)

| Branch      | Purpose                          | Branches off | Merges into                           |
| ----------- | -------------------------------- | ------------ | ------------------------------------- |
| `main`      | released versions only           | -            | -                                     |
| `develop`   | integration of the next release  | `main`       | `main` (release PR)                   |
| `feature/*` | all regular work                 | `develop`    | `develop` (PR)                        |
| `hotfix/*`  | urgent fix of a released version | `main`       | `main` (PR), then back into `develop` |

Rules for agents:

- Work on a `feature/<short-name>` branch off an up-to-date `develop` (or `hotfix/<version>` off `main` for a hotfix). Never commit directly to `main` or `develop`.
- Commit and push only when the maintainer asks. Opening pull requests, merging, tagging and publishing releases are the maintainer's decisions - prepare them, don't do them unasked.
- Never force-push to or delete `main` or `develop`, and never create, move or delete `v*` tags.
- Commit messages follow Conventional Commits in English (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`). Don't start a commit message with `Merge pull request #` or `Merge branch 'main'` - CI skips those commits (see below).

### What GitHub enforces

Rulesets in the repository:

- **`main`**: changes only via pull request, **merge commits only** (no squash/rebase), no force-push, no deletion. Required status checks `test` (CI) and `source-branch` (`pull-request-main.yml`), and the branch must be up to date with `main` before merging.
- **`develop`**: no force-push, no deletion.
- **Tags `v*`**: creating, updating and deleting is restricted (maintainer only).

Workflows (`.github/workflows`):

- `ci.yml` - runs `npm run build` and `cargo test` on Windows for pushes to `develop`, `feature/**` and `hotfix/**`. Pull requests reuse the run of their last commit. Commits starting with `Merge pull request #` or `Merge branch 'main'` are skipped (skipped counts as passed).
- `pull-request-main.yml` - fails pull requests into `main` unless the source is `develop` or `hotfix/*`.
- `sync-develop.yml` - after every push to `main`, fast-forwards `develop` to `main`. If `develop` has its own commits by then, it fails and `main` must be merged into `develop` by hand (`git checkout develop && git pull && git merge main && git push`).
- `release.yml` - on a `v*` tag: checks the tag is on `main` and matches the version in all three files, builds and signs the installer and creates a **draft** release with `latest.json`. Installed apps only see it after the maintainer publishes the draft.

### Release and hotfix (for reference - the maintainer runs these)

Release: on `develop`, bump the version (`npm run version:patch|minor|major`, as decided by the maintainer), PR `develop` → `main`, tag the merge commit on `main` (`vX.Y.Z`), publish the draft release.

Hotfix: `git checkout -b hotfix/X.Y.Z main`, fix, bump the patch version, PR into `main`, tag, publish. Afterwards make sure `develop` contains `main` (sync workflow or manual merge).

## Secrets and signing

Never commit or print the updater signing key (`~/.tauri/tiny-sales.key`) or its password. They live only in the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Don't add company data (names, addresses, VAT numbers, logos) to the source - it belongs in the database via the settings page.
