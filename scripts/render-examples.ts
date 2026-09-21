#!/usr/bin/env node
// Render every *.mdx document in a directory to HTML using the built CLI.
// Usage: render-examples.ts [srcDir] [outDir] — defaults: examples → examples.
// The docs workflow renders examples/ → docs/public/examples/ and
// examples/catalog/ → docs/public/components/.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.resolve(root, process.argv[2] ?? "examples");
const cli = path.join(root, "dist", "cli.mjs");
const outDir = path.resolve(root, process.argv[3] ?? srcDir);
mkdirSync(outDir, { recursive: true });
const assets = path.join(srcDir, "assets");
if (srcDir !== outDir && existsSync(assets)) {
  cpSync(assets, path.join(outDir, "assets"), { recursive: true });
}

const docs = readdirSync(srcDir)
  .filter((name) => /\.mdx?$/u.test(name))
  .toSorted();

if (docs.length === 0) {
  console.log(`mdxr: no .mdx files found in ${srcDir}`);
  process.exit(0);
}

let failures = 0;
for (const doc of docs) {
  const out = path.join(outDir, doc.replace(/\.(?:mdx|md)$/u, ".html"));
  try {
    execFileSync(
      process.execPath,
      [cli, "render", path.join(srcDir, doc), "-o", out],
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
console.log(`mdxr: rendered ${docs.length} documents → ${outDir}`);
