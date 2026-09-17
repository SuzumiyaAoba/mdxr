#!/usr/bin/env node
// Render every examples/*.mdx document to examples/*.html using the built CLI.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const examplesDir = path.join(root, "examples");
const cli = path.join(root, "dist", "cli.mjs");

const docs = readdirSync(examplesDir)
  .filter((name) => /\.mdx?$/u.test(name))
  .toSorted();

if (docs.length === 0) {
  console.log("mdxr: no .mdx files found in examples/");
  process.exit(0);
}

let failures = 0;
for (const doc of docs) {
  try {
    execFileSync(
      process.execPath,
      [cli, "render", path.join(examplesDir, doc)],
      { stdio: "inherit" }
    );
  } catch {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`mdxr: ${failures}/${docs.length} documents failed`);
  process.exit(1);
}
console.log(`mdxr: rendered ${docs.length} documents → examples/*.html`);
