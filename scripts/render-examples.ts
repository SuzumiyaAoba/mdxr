#!/usr/bin/env node
// Render every *.mdx document in a directory to HTML using the built CLI.
// Usage: render-examples.ts [srcDir] [outDir] — defaults: examples → examples.
// The docs workflow renders examples/ → docs/public/examples/ and
// examples/catalog/ → docs/public/components/.
//
// Every document also gets a "<name>.src.html" sibling: the .mdx source inside
// a fenced block, rendered through the CLI itself so docs pages can switch
// between the rendered output and its code with mdxr's own code block styling
// (filename bar + copy button).
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
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

/**
 * Standalone document holding `source` in one fenced code block. The fence is
 * longer than any backtick run in the source so embedded fences can't close
 * it early; `langForPath` maps .mdx to the markdown grammar, so `markdown`
 * matches what `<CodeFile>` would pick for the same file.
 */
const sourceDoc = (rel: string, name: string, source: string): string => {
  let longest = 0;
  for (const run of source.matchAll(/`+/gu)) {
    longest = Math.max(longest, run[0].length);
  }
  const fence = "`".repeat(Math.max(4, longest + 1));
  return `---\ntitle: ${rel}\n---\n\n${fence}markdown title="${name}"\n${source}\n${fence}\n`;
};

const render = (args: string[], input?: string): boolean => {
  try {
    execFileSync(process.execPath, [cli, "render", ...args], {
      input,
      stdio: ["pipe", "inherit", "inherit"],
    });
    return true;
  } catch {
    return false;
  }
};

let failures = 0;
for (const doc of docs) {
  const srcPath = path.join(srcDir, doc);
  const base = doc.replace(/\.(?:mdx|md)$/u, "");
  if (!render([srcPath, "-o", path.join(outDir, `${base}.html`)])) {
    failures += 1;
  }
  const rel = path.relative(root, srcPath).split(path.sep).join("/");
  const wrapper = sourceDoc(rel, doc, readFileSync(srcPath, "utf-8"));
  // Stdin render: the wrapper needs no config or file resolution — the fence
  // is the whole document, so project components never come into play.
  if (
    !render(
      ["-o", path.join(outDir, `${base}.src.html`), "--no-hydrate"],
      wrapper
    )
  ) {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`mdxr: ${failures} render(s) failed`);
  process.exit(1);
}
console.log(`mdxr: rendered ${docs.length} documents (+ sources) → ${outDir}`);
