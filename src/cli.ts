#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cac } from "cac";

import { mdxToAscii } from "./ascii/index.js";
import { catalogEntries, formatCatalog, CONVENTIONS } from "./catalog.js";
import { loadConfig } from "./config.js";
import { formatError, parseErrorFormat } from "./format-error.js";
import { ensureDocsDirIgnored, installSkill } from "./init.js";
import { openInBrowser } from "./open.js";
import { loadUserComponents, render, renderFile } from "./render.js";
import { serve, serveSource } from "./serve.js";
import { builtinComponents } from "./ui/index.js";

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const requireStdinSource = (): void => {
  if (process.stdin.isTTY) {
    throw new Error("no input: pass an .mdx file or pipe MDX source via stdin");
  }
};

/**
 * Write the rendered HTML to stdout — no status line, stdout carries the
 * document itself. Downstream pipes (e.g. `| head`) may close early, so
 * EPIPE is not an error.
 */
const writeStdout = (html: string): void => {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") {
      process.exit(0);
    }
    throw err;
  });
  process.stdout.write(html);
};

const fail = (err: unknown, json: boolean): never => {
  if (json) {
    console.log(JSON.stringify({ error: formatError(err), ok: false }));
  } else {
    console.error(`mdxr: error: ${formatError(err)}`);
  }
  process.exit(1);
};

const cli = cac("mdxr");

cli
  .command("render [file]", "Render an .mdx document to a standalone HTML file")
  .option(
    "-o, --out <path>",
    "Output path (default: <file>.html; stdout for stdin input or '-')"
  )
  .option("--format <format>", "Error output: text | json")
  .option(
    "--no-hydrate",
    "Emit static HTML without the client hydration bundle"
  )
  .option("--open", "Open the rendered file in the default browser")
  .action(
    async (
      file: string | undefined,
      opts: {
        format?: string;
        hydrate?: boolean;
        open?: boolean;
        out?: string;
      }
    ) => {
      const json = opts.format === "json";
      try {
        parseErrorFormat(opts.format);
        const fromStdin = file === undefined || file === "-";
        if (fromStdin) {
          requireStdinSource();
        }

        const out =
          opts.out === "-"
            ? undefined
            : (opts.out ??
              (fromStdin
                ? undefined
                : `${file.replace(/\.(?:mdx|md)$/u, "")}.html`));

        if (out === undefined && opts.open === true) {
          // The browser needs a file to open — stdout carries the HTML.
          throw new Error("--open requires an output file");
        }

        const html = fromStdin
          ? await render(await readStdin(), {
              dir: process.cwd(),
              filePath: "<stdin>",
              hydrate: opts.hydrate,
            })
          : await renderFile(file, { hydrate: opts.hydrate });

        if (out === undefined) {
          writeStdout(html);
          return;
        }
        await writeFile(path.resolve(out), html);
        if (opts.open === true) {
          await openInBrowser(path.resolve(out));
        }
        if (json) {
          console.log(JSON.stringify({ ok: true, out }));
        } else {
          console.log(`mdxr: wrote ${out}`);
        }
      } catch (error) {
        fail(error, json);
      }
    }
  );

cli
  .command("serve [file]", "Preview a document in the browser with live reload")
  .option("-p, --port <port>", "Port", { default: 3737 })
  .option("--open", "Open the preview in the default browser once serving")
  .action(
    async (
      file: string | undefined,
      opts: { open?: boolean; port: number | string }
    ) => {
      try {
        // mri leaves a non-numeric flag as a string; http.listen would treat
        // that as a pipe path instead of a port.
        const port = Number(opts.port);
        if (!Number.isInteger(port) || port < 0 || port > 65_535) {
          throw new Error(`invalid --port: ${opts.port}`);
        }
        const open = opts.open === true;
        if (file === undefined || file === "-") {
          requireStdinSource();
          await serveSource(await readStdin(), port, {
            dir: process.cwd(),
            filePath: "<stdin>",
            open,
          });
          return;
        }
        await serve(file, port, { open });
      } catch (error) {
        fail(error, false);
      }
    }
  );

cli
  .command(
    "text [file]",
    "Render an .mdx document to plain Markdown (components become ASCII/text)"
  )
  .option(
    "-o, --out <path>",
    "Output path (default: <file>.txt.md; stdout for stdin input or '-')"
  )
  .action(async (file: string | undefined, opts: { out?: string }) => {
    try {
      const fromStdin = file === undefined || file === "-";
      if (fromStdin) {
        requireStdinSource();
      }

      const { markdown, warnings } = fromStdin
        ? await mdxToAscii(await readStdin(), "<stdin>")
        : await mdxToAscii(await readFile(file, "utf-8"), file);
      for (const w of warnings) {
        console.error(`mdxr: warning: ${w}`);
      }

      const out =
        opts.out === "-"
          ? undefined
          : (opts.out ??
            (fromStdin
              ? undefined
              : `${file.replace(/\.(?:mdx|md)$/u, "")}.txt.md`));

      if (out === undefined) {
        writeStdout(markdown);
        return;
      }
      await writeFile(path.resolve(out), markdown);
      console.log(`mdxr: wrote ${out}`);
    } catch (error) {
      fail(error, false);
    }
  });

cli
  .command("catalog", "List available components (built-in + project-defined)")
  .option("--json", "Print machine-readable JSON")
  .option("--dir <dir>", "Project directory to read mdxr.config.ts from")
  .action(async (opts: { json?: boolean; dir?: string }) => {
    try {
      const dir = path.resolve(opts.dir ?? process.cwd());
      const config = await loadConfig(dir);
      const user = await loadUserComponents(config);
      const entries = catalogEntries(user.components);
      if (opts.json === true) {
        console.log(
          JSON.stringify(
            {
              builtins: Object.keys(builtinComponents),
              components: entries,
              conventions: CONVENTIONS,
            },
            null,
            2
          )
        );
      } else {
        console.log(formatCatalog(entries));
      }
    } catch (error) {
      fail(error, false);
    }
  });

cli
  .command("init", "Install the mdxr agent skill into this project")
  .option("--tool <tool>", "agents | claude | devin | all", {
    default: "agents",
  })
  .option("--global", "Install into your home directory instead of the project")
  .option("--force", "Overwrite an existing skill")
  .action(async (opts: { tool: string; global?: boolean; force?: boolean }) => {
    try {
      const paths = await installSkill(opts);
      for (const p of paths) {
        console.log(`mdxr: installed skill → ${p}`);
      }
      if (opts.global !== true) {
        // Agents write mdxr documents to .mdxr/ — keep that scratch space
        // out of git. A --global install is about the home dir, so the
        // project's .gitignore is left alone.
        const status = await ensureDocsDirIgnored(process.cwd());
        console.log(
          status === "added"
            ? "mdxr: added .mdxr/ to .gitignore"
            : "mdxr: .gitignore already covers .mdxr/"
        );
      }
    } catch (error) {
      fail(error, false);
    }
  });

cli.help();
cli.parse();
