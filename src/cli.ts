#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cac } from "cac";

import packageJson from "../package.json" with { type: "json" };
import { validateAgentOptions } from "./agent-options.js";
import { mdxToAscii } from "./ascii/index.js";
import { catalogEntries, formatCatalog, CONVENTIONS } from "./catalog.js";
import { formatDiagnostic } from "./check-diagnostics.js";
import { formatGithubDiagnostic } from "./check-github.js";
import { watchDocuments } from "./check-watch.js";
import { checkDocument, checkDocuments, checkResult } from "./check.js";
import type { CheckResult } from "./check.js";
import { normalizeOutputArgs } from "./cli-args.js";
import { loadConfig } from "./config.js";
import { formatError, parseErrorFormat } from "./format-error.js";
import { ensureDocsDirIgnored, installSkill } from "./init.js";
import { installInstructions } from "./instructions.js";
import { serveLibrary } from "./library.js";
import { openInBrowser } from "./open.js";
import { loadUserComponents, render, renderFile } from "./render.js";
import { serveDocuments } from "./serve-documents.js";
import {
  DEFAULT_IDLE_TIMEOUT,
  handlePreviewSignals,
  parseIdleTimeout,
} from "./serve-lifetime.js";
import { serveSource } from "./serve.js";
import {
  createDocument,
  DOCUMENT_TEMPLATES,
  templateSource,
} from "./templates.js";
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
    "check [path]",
    "Validate Markdown and MDX documents (default: .mdxr)"
  )
  .option("--format <format>", "Diagnostic output: text | json | github")
  .option("--watch", "Revalidate documents and dependencies on changes")
  .option("--config <file>", "Explicit project configuration")
  .option("--project <dir>", "Project root for configuration discovery")
  .option("--strict", "Treat warnings as failures")
  .option("--render", "Also load project components and validate rendering")
  .action(
    async (
      input: string | undefined,
      opts: {
        format?: string;
        strict?: boolean;
        render?: boolean;
        watch?: boolean;
        config?: string;
        project?: string;
      }
    ) => {
      const json = opts.format === "json";
      try {
        if (opts.format !== "github") {
          parseErrorFormat(opts.format);
        }
        const fromStdin =
          input === "-" ||
          (input === undefined && process.argv.slice(2).includes("-"));
        if (fromStdin) {
          requireStdinSource();
        }
        const output = (result: CheckResult): void => {
          if (json) {
            console.log(JSON.stringify(result));
          } else {
            for (const diagnostic of result.diagnostics) {
              console.log(
                opts.format === "github"
                  ? formatGithubDiagnostic(diagnostic)
                  : formatDiagnostic(diagnostic)
              );
            }
            console.log(
              `mdxr: checked ${result.files.length} documents: ${result.errors} errors, ${result.warnings} warnings`
            );
          }
          process.exitCode = result.ok ? 0 : 1;
        };
        if (opts.watch === true) {
          if (fromStdin) {
            throw new Error("--watch requires a file or directory");
          }
          const watcher = await watchDocuments(input ?? ".mdxr", opts, output);
          for (const signal of ["SIGINT", "SIGTERM"] as const) {
            process.once(signal, () => {
              watcher.close();
            });
          }
          return;
        }
        output(
          fromStdin
            ? checkResult(
                ["<stdin>"],
                await checkDocument(await readStdin(), "<stdin>", opts),
                opts.strict
              )
            : await checkDocuments(input, opts)
        );
      } catch (error) {
        fail(error, json);
      }
    }
  );

cli
  .command("new [file]", "Create a document from a template")
  .option("--template <name>", "plan | investigation | review")
  .option("--title <title>", "Document title")
  .option("-o, --out <file>", "Exact output file (never overwritten)")
  .option("--dir <directory>", "Parent directory for a timestamped document")
  .action(
    async (
      file: string | undefined,
      opts: { template?: string; title?: string; out?: string; dir?: string }
    ) => {
      try {
        if (file !== undefined && opts.out !== undefined) {
          throw new Error("Use either a file argument or --out");
        }
        console.log(
          `mdxr: created ${await createDocument({ ...opts, out: file ?? opts.out })}`
        );
      } catch (error) {
        fail(error, false);
      }
    }
  );
cli
  .command("templates [name]", "List templates or print a template's MDX")
  .option("--json", "List template names as JSON")
  .action((name: string | undefined, opts: { json?: boolean }) => {
    try {
      if (name === undefined) {
        console.log(
          opts.json === true
            ? JSON.stringify(DOCUMENT_TEMPLATES)
            : DOCUMENT_TEMPLATES.join("\n")
        );
        return;
      }
      const template = DOCUMENT_TEMPLATES.find(
        (candidate) => candidate === name
      );
      if (template === undefined) {
        throw new Error(`Unknown template: ${name}`);
      }
      writeStdout(templateSource(template));
    } catch (error) {
      fail(error, opts.json === true);
    }
  });

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
  .option(
    "--idle-timeout <seconds>",
    "Stop after this many seconds without browser connections (0: never)",
    { default: DEFAULT_IDLE_TIMEOUT }
  )
  .action(
    async (
      dir: string | undefined,
      opts: {
        open?: boolean;
        port: number | string;
        idleTimeout: number | string;
      }
    ) => {
      try {
        const port = Number(opts.port);
        if (!Number.isInteger(port) || port < 0 || port > 65_535) {
          throw new Error(`invalid --port: ${opts.port}`);
        }
        handlePreviewSignals(
          await serveLibrary(dir ?? ".mdxr", port, {
            idleTimeout: parseIdleTimeout(opts.idleTimeout),
            open: opts.open === true,
          })
        );
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
  .option("--config <file>", "Explicit project configuration")
  .option("--project <dir>", "Project root for configuration discovery")
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
        config?: string;
        project?: string;
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
              config: opts.config,
              dir: process.cwd(),
              filePath: "<stdin>",
              hydrate: opts.hydrate,
              project: opts.project,
            })
          : await renderFile(file, {
              config: opts.config,
              hydrate: opts.hydrate,
              project: opts.project,
            });

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
  .option("--config <file>", "Explicit project configuration")
  .option("--project <dir>", "Project root for configuration discovery")
  .option("--agent <agent>", "Chat with codex or claude in the preview")
  .option("--session <id>", "Send to an existing Codex thread")
  .option("--server <url>", "Codex App Server ws:// or unix:// endpoint")
  .option(
    "--idle-timeout <seconds>",
    "Stop after this many seconds without browser connections (0: never)",
    { default: DEFAULT_IDLE_TIMEOUT }
  )
  .action(
    async (
      input: string | undefined,
      opts: {
        agent?: string;
        config?: string;
        project?: string;
        open?: boolean | string;
        port: number | string;
        session?: string;
        server?: string;
        idleTimeout: number | string;
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
        const idleTimeout = parseIdleTimeout(opts.idleTimeout);
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
          handlePreviewSignals(
            await serveSource(await readStdin(), port, {
              config: opts.config,
              dir: process.cwd(),
              filePath: "<stdin>",
              idleTimeout,
              open: opts.open === true,
              project: opts.project,
            })
          );
          return;
        }
        handlePreviewSignals(
          await serveDocuments(input, port, {
            agent,
            config: opts.config,
            idleTimeout,
            open: opts.open,
            project: opts.project,
            server: opts.server,
            session: opts.session,
          })
        );
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
cli.parse(normalizeOutputArgs(process.argv));
