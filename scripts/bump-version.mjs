// Raises the app version everywhere it is stored: package.json (and its
// lock file), src-tauri/Cargo.toml (and Cargo.lock) and tauri.conf.json.
//
//   node scripts/bump-version.mjs patch|minor|major

import { readFileSync, writeFileSync } from "node:fs";

const part = process.argv[2];
if (!["patch", "minor", "major"].includes(part)) {
  console.error("Usage: node scripts/bump-version.mjs patch|minor|major");
  process.exit(1);
}

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const write = (path, content) => writeFileSync(new URL(path, root), content);

/** Replaces exactly one match, so a changed file layout fails loudly instead of silently. */
function replaceOnce(path, pattern, replacement) {
  const content = read(path);
  const matches = content.match(new RegExp(pattern.source, pattern.flags + "g")) ?? [];
  if (matches.length !== 1) {
    console.error(`${path}: expected one version entry, found ${matches.length}`);
    process.exit(1);
  }
  write(path, content.replace(pattern, replacement));
}

const current = JSON.parse(read("package.json")).version;
const versions = {
  "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
  "src-tauri/Cargo.toml": read("src-tauri/Cargo.toml").match(/^version = "([^"]+)"/m)?.[1],
};
for (const [path, version] of Object.entries(versions)) {
  if (version !== current) {
    console.error(`${path} has version ${version}, package.json has ${current} - align them first`);
    process.exit(1);
  }
}

const [major, minor, patch] = current.split(".").map(Number);
const next = {
  patch: `${major}.${minor}.${patch + 1}`,
  minor: `${major}.${minor + 1}.0`,
  major: `${major + 1}.0.0`,
}[part];

// Edited as text where possible, so the files keep their formatting.
replaceOnce("package.json", /("version": )"[^"]+"/, `$1"${next}"`);
const lock = JSON.parse(read("package-lock.json"));
lock.version = next;
lock.packages[""].version = next;
write("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
replaceOnce("src-tauri/tauri.conf.json", /^(  "version": )"[^"]+"/m, `$1"${next}"`);
replaceOnce("src-tauri/Cargo.toml", /^(version = )"[^"]+"/m, `$1"${next}"`);
replaceOnce("src-tauri/Cargo.lock", /(name = "tiny-sales"\r?\nversion = )"[^"]+"/, `$1"${next}"`);

console.log(`${current} -> ${next}`);
