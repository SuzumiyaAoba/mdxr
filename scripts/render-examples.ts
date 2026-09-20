#!/usr/bin/env node
// Render every examples/*.mdx document to HTML using the built CLI.
// Default output is examples/*.html; pass a directory to write elsewhere
// (the docs workflow renders into docs/public/examples/).
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const examplesDir = path.join(root, "examples");
const cli = path.join(root, "dist", "cli.mjs");
const outDir = path.resolve(root, process.argv[2] ?? examplesDir);
mkdirSync(outDir, { recursive: true });

const docs = readdirSync(examplesDir)
  .filter((name) => /\.mdx?$/u.test(name))
  .toSorted();

if (docs.length === 0) {
  console.log("mdxr: no .mdx files found in examples/");
  process.exit(0);
}

let failures = 0;
for (const doc of docs) {
  const out = path.join(outDir, doc.replace(/\.(?:mdx|md)$/u, ".html"));
  try {
    execFileSync(
      process.execPath,
      [cli, "render", path.join(examplesDir, doc), "-o", out],
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
