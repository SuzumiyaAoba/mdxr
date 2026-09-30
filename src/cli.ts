#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cac } from "cac";

import packageJson from "../package.json" with { type: "json" };
import { validateAgentOptions } from "./agent-options.js";
import { mdxToAscii } from "./ascii/index.js";
import { catalogEntries, formatCatalog, CONVENTIONS } from "./catalog.js";
import { loadConfig } from "./config.js";
import { formatError, parseErrorFormat } from "./format-error.js";
import { ensureDocsDirIgnored, installSkill } from "./init.js";
import { installInstructions } from "./instructions.js";
import { serveLibrary } from "./library.js";
import { openInBrowser } from "./open.js";
import { loadUserComponents, render, renderFile } from "./render.js";
import { serveDocuments } from "./serve-documents.js";
import { serveSource } from "./serve.js";
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

const cli = cac("mdxr").version(packageJson.version);

cli
  .command(
    "library [dir]",
    "Browse and search local Markdown and MDX documents"
  )
  .option(
    "-p, --port <port>",
    "Preferred port; if taken, the next free port is used",
    { default: 3737 }
  )
  .option("--open", "Open the document library in the default browser")
  .action(
    async (
      dir: string | undefined,
      opts: { open?: boolean; port: number | string }
    ) => {
      try {
        const port = Number(opts.port);
        if (!Number.isInteger(port) || port < 0 || port > 65_535) {
          throw new Error(`invalid --port: ${opts.port}`);
        }
        await serveLibrary(dir ?? ".mdxr", port, { open: opts.open === true });
      } catch (error) {
        fail(error, false);
      }
    }
  );

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
  .command(
    "serve [path]",
    "Serve a document directory (default: .mdxr) with live previews"
  )
  .option(
    "-p, --port <port>",
    "Preferred port; if taken, the next free port is used",
    { default: 3737 }
  )
  .option(
    "--open [file]",
    "Open a document path or the directory listing in the default browser"
  )
  .option("--agent <agent>", "Chat with codex or claude in the preview")
  .option("--session <id>", "Send to an existing Codex thread")
  .option("--server <url>", "Codex App Server ws:// or unix:// endpoint")
  .action(
    async (
      input: string | undefined,
      opts: {
        agent?: string;
        open?: boolean | string;
        port: number | string;
        session?: string;
        server?: string;
      }
    ) => {
      try {
        // mri leaves a non-numeric flag as a string; http.listen would treat
        // that as a pipe path instead of a port.
        const port = Number(opts.port);
        if (!Number.isInteger(port) || port < 0 || port > 65_535) {
          throw new Error(`invalid --port: ${opts.port}`);
        }
        const agent = validateAgentOptions(
          opts.agent,
          opts.session,
          opts.server
        );
        // cac drops a lone '-' unless it follows '--'; keep explicit stdin
        // distinct from the default directory even when the parser omits it.
        const fromStdin =
          input === "-" ||
          (input === undefined && process.argv.slice(2).includes("-"));
        if (fromStdin) {
          if (agent !== undefined) {
            throw new Error("--agent does not support stdin");
          }
          if (typeof opts.open === "string") {
            throw new TypeError("--open <file> requires a document directory");
          }
          requireStdinSource();
          await serveSource(await readStdin(), port, {
            dir: process.cwd(),
            filePath: "<stdin>",
            open: opts.open === true,
          });
          return;
        }
        await serveDocuments(input, port, {
          agent,
          open: opts.open,
          server: opts.server,
          session: opts.session,
        });
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
  .command("init", "Install mdxr instructions for Codex and Claude")
  .option(
    "--tool <tool>",
    "codex | claude | all (with --skill: agents | claude | devin | all)"
  )
  .option(
    "--global",
    "Install into your home directory (default for instructions)"
  )
  .option("--local", "Install into the current project")
  .option("--skill", "Install the agent skill instead (local by default)")
  .option(
    "--force",
    "Replace existing mdxr files; preserve agent config contents"
  )
  .action(
    async (opts: {
      tool?: string;
      global?: boolean;
      local?: boolean;
      skill?: boolean;
      force?: boolean;
    }) => {
      try {
        if (opts.global === true && opts.local === true) {
          throw new Error("--global and --local cannot be used together");
        }
        const global =
          opts.global === true || (opts.local !== true && opts.skill !== true);
        const options = { ...opts, global };
        if (opts.skill === true) {
          const paths = await installSkill(options);
          for (const p of paths) {
            console.log(`mdxr: installed skill → ${p}`);
          }
        } else {
          const installed = await installInstructions(options);
          for (const result of installed) {
            console.log(
              `mdxr: installed instructions → ${result.instructions}`
            );
            console.log(
              `mdxr: ${result.status === "added" ? "added reference to" : "reference already present in"} ${result.config}`
            );
          }
        }
        if (!global) {
          // Agents write mdxr documents to .mdxr/ — keep that scratch space
          // out of git. A --global install is about the home dir, so the
          // project's .gitignore is left alone; a global git excludes rule
          // makes the project rule redundant too.
          const status = await ensureDocsDirIgnored(process.cwd());
          const messages = {
            added: "mdxr: added .mdxr/ to .gitignore",
            global:
              "mdxr: .mdxr/ is already covered by your global git excludes",
            present: "mdxr: .gitignore already covers .mdxr/",
          } as const;
          console.log(messages[status]);
        }
      } catch (error) {
        fail(error, false);
      }
    }
  );

cli.help();
cli.parse();
