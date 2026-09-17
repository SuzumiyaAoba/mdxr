#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { cac } from "cac";

import { catalogEntries, formatCatalog, CONVENTIONS } from "./catalog.js";
import { loadConfig } from "./config.js";
import { formatError } from "./format-error.js";
import { installSkill } from "./init.js";
import { loadComponents, render, renderFile } from "./render.js";
import { serve, serveSource } from "./serve.js";
import { builtinComponents } from "./ui/index.js";

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const fail = (err: unknown, json: boolean): never => {
  if (json) {
    console.log(JSON.stringify({ error: formatError(err), ok: false }));
  } else {
    console.error(`rv: error: ${formatError(err)}`);
  }
  process.exit(1);
};

const cli = cac("rv");

cli
  .command("render [file]", "Render an .mdx document to a standalone HTML file")
  .option(
    "-o, --out <path>",
    "Output path (default: <file>.html; stdout for stdin input or '-')"
  )
  .option("--format <format>", "Error output: text | json")
  .action(
    async (
      file: string | undefined,
      opts: { out?: string; format?: string }
    ) => {
      const json = opts.format === "json";
      try {
        const fromStdin = file === undefined || file === "-";
        if (fromStdin && process.stdin.isTTY) {
          throw new Error(
            "no input: pass an .mdx file or pipe MDX source via stdin"
          );
        }

        const html = fromStdin
          ? await render(await readStdin(), {
              dir: process.cwd(),
              filePath: "<stdin>",
            })
          : await renderFile(file);

        const out =
          opts.out === "-"
            ? undefined
            : (opts.out ??
              (file === undefined || file === "-"
                ? undefined
                : `${file.replace(/\.(?:mdx|md)$/u, "")}.html`));

        if (out === undefined) {
          // No status line: stdout carries the HTML itself. Downstream
          // pipes (e.g. `| head`) may close early — EPIPE is not an error.
          process.stdout.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EPIPE") {
              process.exit(0);
            }
            throw err;
          });
          process.stdout.write(html);
          return;
        }
        await writeFile(path.resolve(out), html);
        if (json) {
          console.log(JSON.stringify({ ok: true, out }));
        } else {
          console.log(`rv: wrote ${out}`);
        }
      } catch (error) {
        fail(error, json);
      }
    }
  );

cli
  .command("serve [file]", "Preview a document in the browser with live reload")
  .option("-p, --port <port>", "Port", { default: 3737 })
  .action(async (file: string | undefined, opts: { port: number }) => {
    try {
      if (file === undefined || file === "-") {
        if (process.stdin.isTTY) {
          throw new Error(
            "no input: pass an .mdx file or pipe MDX source via stdin"
          );
        }
        await serveSource(await readStdin(), opts.port, {
          dir: process.cwd(),
          filePath: "<stdin>",
        });
        return;
      }
      await serve(file, opts.port);
    } catch (error) {
      fail(error, false);
    }
  });

cli
  .command("catalog", "List available components (built-in + project-defined)")
  .option("--json", "Print machine-readable JSON")
  .option("--dir <dir>", "Project directory to read rv.config.ts from")
  .action(async (opts: { json?: boolean; dir?: string }) => {
    try {
      const dir = path.resolve(opts.dir ?? process.cwd());
      const config = await loadConfig(dir);
      const user =
        config.componentsPath === undefined
          ? { components: {} }
          : await loadComponents(config.componentsPath);
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
  .command("init", "Install the rv agent skill into this project")
  .option("--tool <tool>", "agents | claude | devin | all", {
    default: "agents",
  })
  .option("--global", "Install into your home directory instead of the project")
  .option("--force", "Overwrite an existing skill")
  .action(async (opts: { tool: string; global?: boolean; force?: boolean }) => {
    try {
      const paths = await installSkill(opts);
      for (const p of paths) {
        console.log(`rv: installed skill → ${p}`);
      }
    } catch (error) {
      fail(error, false);
    }
  });

cli.help();
cli.parse();
