#!/usr/bin/env node
// Render every *.mdx document in a directory to HTML using the built CLI.
// Usage: render-examples.ts [srcDir] [outDir] [--split]
// defaults: examples → examples. The docs workflow renders
// examples/ → docs/public/examples/ and examples/catalog/ →
// docs/public/components/ (with --split).
//
// Every document also gets a "<name>.src.html" sibling: the .mdx source inside
// a fenced block, rendered through the CLI itself so docs pages can switch
// between the rendered output and its code with mdxr's own code block styling
// (filename bar + copy button).
//
// --split additionally renders each top-level `##` section as its own
// standalone document, "<base>--<slug>.html", so docs pages can focus an
// iframe on exactly one component instead of the whole family page. Content
// before the first `##` becomes an "overview" fragment when it carries
// component demos. A sections.json manifest (slug/title/source per section)
// is written to outDir for scripts/sync-demo-pages.ts.
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const argv = process.argv.slice(2);
const split = argv.includes("--split");
const positional = argv.filter((a) => !a.startsWith("--"));
const srcDir = path.resolve(root, positional[0] ?? "examples");
const cli = path.join(root, "dist", "cli.mjs");
const outDir = path.resolve(root, positional[1] ?? srcDir);
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

interface Section {
  slug: string;
  title: string;
  /** Section body without the `##` heading — what docs pages show as code. */
  source: string;
}

/**
 * GitHub-style heading slugger, applied per document with `-1`/`-2` dedup.
 * The fragment filenames use these slugs — they need only be unique and
 * deterministic, not byte-identical to the renderer's own heading ids.
 */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

/** Stateful fence tracker: reports whether a line is inside/starts/ends a
 * fenced code block — those lines can never be section boundaries. */
const fenceTracker = (): ((line: string) => boolean) => {
  let fence: string | undefined;
  return (line: string): boolean => {
    const run = /^(?<run>`{3,}|~{3,})/u.exec(line)?.groups?.run;
    if (run === undefined) {
      return fence !== undefined;
    }
    const closes =
      fence !== undefined &&
      new RegExp(`^${run[0]}{${fence.length},}\\s*$`, "u").test(line);
    fence = closes ? undefined : (fence ?? run);
    return true;
  };
};

/** `:::` opener (`+1`) or bare `:::` closer (`-1`); undefined when not one. */
const directiveDelta = (line: string): number | undefined => {
  const rest = /^:::(?<rest>.*)$/u.exec(line)?.groups?.rest;
  if (rest === undefined) {
    return undefined;
  }
  return rest.trim() === "" ? -1 : 1;
};

/**
 * Split a document body into its top-level `##` sections. Fenced code blocks
 * and `:::` directive containers are tracked so `##` lines inside them don't
 * count as boundaries. Returns the pre-section content (frontmatter and the
 * `#` title heading stripped) alongside the sections.
 */
const splitSections = (
  source: string
): { pre: string; sections: { title: string; body: string }[] } => {
  const lines = source.split("\n");
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.indexOf("---", 1);
    start = end === -1 ? 1 : end + 1;
  }
  const preLines: string[] = [];
  const raw: { title: string; lines: string[] }[] = [];
  let current: string[] | undefined;
  let depth = 0;
  const insideFence = fenceTracker();
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    const fenced = insideFence(line);
    const heading =
      fenced || depth > 0
        ? undefined
        : /^## +(?<title>.+?)\s*$/u.exec(line)?.groups?.title;
    if (heading !== undefined) {
      current = [];
      raw.push({ lines: current, title: heading });
      continue;
    }
    if (!fenced) {
      depth = Math.max(0, depth + (directiveDelta(line) ?? 0));
    }
    (current ?? preLines).push(line);
  }
  return {
    pre: preLines.join("\n"),
    sections: raw.map(({ title, lines: body }) => ({
      body: body.join("\n"),
      title,
    })),
  };
};

/** `:::toc` blocks only make sense at document scope — drop them from fragments. */
const stripToc = (source: string): string =>
  source.replaceAll(/^:::toc[^\n]*\n(?:(?!^:::).*\n)*?:::\n?/gmu, "");

/**
 * Turn the raw split into renderable sections. The pre-`##` content counts as
 * an "overview" section only when it demos components (JSX, a directive, or a
 * code fence) — a bare title/lead-in is not worth a fragment.
 */
const toSections = (source: string): Section[] => {
  const { pre, sections } = splitSections(source);
  const out: Section[] = [];
  const used = new Map<string, number>();
  const push = (title: string, body: string): void => {
    const base = slugify(title) || "section";
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    out.push({
      slug: seen === 0 ? base : `${base}-${seen}`,
      source: body.trim(),
      title,
    });
  };
  const overview = stripToc(pre.replaceAll(/^# .*$/gmu, "")).trim();
  const demosComponent =
    /<[A-Z]/u.test(overview) ||
    /^:::/mu.test(overview) ||
    /^```/mu.test(overview);
  if (sections.length > 0 && demosComponent) {
    push("Overview", overview);
  }
  for (const { title, body } of sections) {
    push(title, body);
  }
  return out;
};

const render = async (
  args: string[],
  input: string | undefined,
  cwd: string
): Promise<boolean> => {
  const child = spawn(process.execPath, [cli, "render", ...args], {
    cwd,
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin.end(input);
  const result: unknown[] = await once(child, "close");
  return result[0] === 0;
};

const queue: (() => Promise<void>)[] = [];
let failures = 0;
const enqueue = (
  args: string[],
  input: string | undefined,
  cwd: string
): void => {
  queue.push(async () => {
    if (!(await render(args, input, cwd))) {
      failures += 1;
    }
  });
};

interface ManifestEntry {
  title: string;
  sections: { slug: string; title: string; source: string }[];
}
const manifest: Record<string, ManifestEntry> = {};

for (const doc of docs) {
  const srcPath = path.join(srcDir, doc);
  const base = doc.replace(/\.(?:mdx|md)$/u, "");
  enqueue([srcPath, "-o", path.join(outDir, `${base}.html`)], undefined, root);
  const rel = path.relative(root, srcPath).split(path.sep).join("/");
  const source = readFileSync(srcPath, "utf-8");
  const wrapper = sourceDoc(rel, doc, source);
  // Stdin render: the wrapper needs no config or file resolution — the fence
  // is the whole document, so project components never come into play.
  enqueue(
    ["-o", path.join(outDir, `${base}.src.html`), "--no-hydrate"],
    wrapper,
    root
  );
  if (split) {
    const sections = toSections(source);
    manifest[base] = {
      sections,
      title:
        /^title:\s*(?<title>.+)$/mu
          .exec(source)
          ?.groups?.title.trim()
          .replaceAll(/^["']|["']$/gu, "") ?? base,
    };
    for (const section of sections) {
      // stdin render with cwd=srcDir so mdxr.config.ts and relative paths
      // (Include, assets) resolve exactly as they do for the file itself.
      enqueue(
        ["-o", path.join(outDir, `${base}--${section.slug}.html`)],
        `## ${section.title}\n\n${section.source}\n`,
        srcDir
      );
    }
  }
}

const pool = Math.min(8, Math.max(1, os.cpus().length));
const worker = async (): Promise<void> => {
  const task = queue.shift();
  if (task === undefined) {
    return;
  }
  await task();
  await worker();
};
await Promise.all(Array.from({ length: pool }, worker));

if (split) {
  writeFileSync(
    path.join(outDir, "sections.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

if (failures > 0) {
  console.error(`mdxr: ${failures} render(s) failed`);
  process.exit(1);
}
console.log(
  `mdxr: rendered ${docs.length} documents (+ sources${split ? " + sections" : ""}) → ${outDir}`
);
