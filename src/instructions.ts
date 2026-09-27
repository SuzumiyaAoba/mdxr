import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { nonEmpty, own } from "./guards.js";
import type { InitOptions } from "./init.js";
import { pkgRoot } from "./paths.js";

const INSTRUCTION_FILES: Record<string, string> = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
};
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n\s*/u;

const readOptional = async (file: string): Promise<string | null> => {
  try {
    return await fsp.readFile(file, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export interface InstalledInstructions {
  instructions: string;
  config: string;
  status: "added" | "present";
}

interface InstructionTarget {
  config: string;
  content: string;
  entry: string;
  instructions: string;
  references: string;
}

const instructionTarget = (
  name: string,
  base: string,
  global: boolean,
  source: string
): InstructionTarget => {
  const filename = own(INSTRUCTION_FILES, name);
  if (filename === undefined) {
    throw new Error(
      `unknown tool: ${name} (expected codex|claude|all; use --skill for agents or devin)`
    );
  }
  const codexHome = nonEmpty(process.env.CODEX_HOME)
    ? process.env.CODEX_HOME
    : path.join(base, ".codex");
  const directory =
    global && name === "codex"
      ? path.resolve(codexHome)
      : path.join(base, `.${name}`);
  const instructions = path.join(directory, "MDXR.md");
  const config = path.join(global ? directory : base, filename);
  const references = path.join(directory, "mdxr/references");
  const referencePath = (global ? references : path.relative(base, references))
    .split(path.sep)
    .join("/");
  const content = source
    .replace(FRONTMATTER, "")
    .replaceAll("references/", `${referencePath}/`);
  const importPath = global ? "./MDXR.md" : `./.${name}/MDXR.md`;
  // Codex reads prose instructions; Claude supports native @file imports.
  const entry =
    name === "claude"
      ? `@${importPath}`
      : `Read and follow the mdxr instructions in \`${global ? instructions.split(path.sep).join("/") : importPath}\` (relative paths resolve from this AGENTS.md) when creating plans, reports, reviews, or other structured documents, and whenever the user requests mdxr.`;
  return { config, content, entry, instructions, references };
};

const installTarget = async (
  target: InstructionTarget & { configContent: string },
  force: boolean
): Promise<InstalledInstructions> => {
  await fsp.mkdir(path.dirname(target.instructions), { recursive: true });
  if (force) {
    await fsp.rm(target.references, { force: true, recursive: true });
  }
  await fsp.cp(path.join(pkgRoot, "skill/references"), target.references, {
    recursive: true,
  });
  await fsp.writeFile(target.instructions, target.content);
  const present = target.configContent
    .split(/\r?\n/u)
    .some((line) => line.trim() === target.entry);
  if (!present) {
    const newline = target.configContent.includes("\r\n") ? "\r\n" : "\n";
    const separator =
      target.configContent.length > 0 && !target.configContent.endsWith("\n")
        ? newline
        : "";
    await fsp.appendFile(
      target.config,
      `${separator}${target.entry}${newline}`
    );
  }
  return {
    config: target.config,
    instructions: target.instructions,
    status: present ? "present" : "added",
  };
};

/** Install persistent instructions while preserving the user's agent config. */
export const installInstructions = async (
  opts: InitOptions
): Promise<InstalledInstructions[]> => {
  const global = opts.global !== false;
  const base = global ? os.homedir() : process.cwd();
  const tool = opts.tool ?? "all";
  const tools = tool === "all" ? Object.keys(INSTRUCTION_FILES) : [tool];
  const source = await fsp.readFile(
    path.join(pkgRoot, "skill/SKILL.md"),
    "utf-8"
  );
  const targets = tools.map((name) =>
    instructionTarget(name, base, global, source)
  );
  // Read all configs and detect conflicts before modifying any target.
  const prepared = await Promise.all(
    targets.map(async (target) => {
      const existing = await readOptional(target.instructions);
      if (
        existing !== null &&
        existing !== target.content &&
        opts.force !== true
      ) {
        throw new Error(
          `${target.instructions} already exists with different content (use --force to overwrite)`
        );
      }
      const configContent = (await readOptional(target.config)) ?? "";
      return { ...target, configContent };
    })
  );
  return await Promise.all(
    prepared.map(
      async (target) => await installTarget(target, opts.force === true)
    )
  );
};
