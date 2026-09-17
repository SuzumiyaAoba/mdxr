import { describe, expect, it } from "vitest";

import { mdxToHtml } from "../src/mdx.js";
import { fileIcon, folderIcon } from "../src/ui/file-icon.js";
import { hasIcon } from "../src/ui/icon.js";
import { builtinComponents } from "../src/ui/index.js";

describe(fileIcon, () => {
  it.each([
    ["src/mdx.ts", "vscode-icons:file-type-typescript"],
    ["app.tsx", "vscode-icons:file-type-reactts"],
    ["index.d.ts", "vscode-icons:file-type-typescriptdef"],
    ["src/util.test.ts", "vscode-icons:file-type-testts"],
    ["main.rs", "vscode-icons:file-type-rust"],
    ["README.md", "vscode-icons:file-type-markdown"],
    ["doc.mdx", "vscode-icons:file-type-mdx"],
    ["script.py", "vscode-icons:file-type-python"],
    ["style.scss", "vscode-icons:file-type-scss"],
    ["data.csv", "vscode-icons:file-type-excel"],
    ["logo.svg", "vscode-icons:file-type-svg"],
    ["photo.png", "vscode-icons:file-type-image"],
    ["archive.tar.gz", "vscode-icons:file-type-zip"],
  ])("maps %s to %s", (path, expected) => {
    expect(fileIcon(path)).toBe(expected);
  });

  it.each([
    ["package.json", "vscode-icons:file-type-npm"],
    ["pnpm-lock.yaml", "vscode-icons:file-type-pnpm"],
    ["tsconfig.json", "vscode-icons:file-type-tsconfig"],
    ["tsconfig.app.json", "vscode-icons:file-type-tsconfig"],
    ["Cargo.toml", "vscode-icons:file-type-cargo"],
    ["go.mod", "vscode-icons:file-type-go-package"],
    [".gitignore", "vscode-icons:file-type-git"],
    [".env.local", "vscode-icons:file-type-dotenv"],
    ["Dockerfile", "vscode-icons:file-type-docker"],
    ["docker-compose.yml", "vscode-icons:file-type-docker"],
    ["LICENSE", "vscode-icons:file-type-license"],
    ["CODEOWNERS", "vscode-icons:file-type-codeowners"],
    ["AGENTS.md", "vscode-icons:file-type-agents"],
    ["CLAUDE.md", "vscode-icons:file-type-claude"],
    ["vite.config.ts", "vscode-icons:file-type-vite"],
    ["eslint.config.js", "vscode-icons:file-type-eslint"],
    ["foo.config.ts", "vscode-icons:file-type-config"],
    ["lefthook.yml", "vscode-icons:file-type-lefthook"],
    ["main.stories.tsx", "vscode-icons:file-type-storybook"],
    ["a.lock", "lucide:lock"],
  ])("maps filename %s to %s", (path, expected) => {
    expect(fileIcon(path)).toBe(expected);
  });

  it("falls back to the default file icon for unknown types", () => {
    expect(fileIcon("notes.xyz123")).toBe("vscode-icons:default-file");
    expect(fileIcon("")).toBe("vscode-icons:default-file");
  });

  it("probes the set for unmapped extensions", () => {
    // `file-type-gleam` exists but is not in the explicit table
    expect(fileIcon("main.gleam")).toBe("vscode-icons:file-type-gleam");
  });

  it("accepts bare lang ids for code headers", () => {
    expect(fileIcon("ts")).toBe("vscode-icons:file-type-typescript");
    expect(fileIcon("python")).toBe("vscode-icons:file-type-python");
  });

  it.each([
    "a.b",
    "x.unknownext",
    ".hidden",
    "no-ext",
    "deep/dir/file.tsx",
    "C:\\win\\path.rs",
  ])("always resolves to a registered icon: %s", (path) => {
    expect(hasIcon(fileIcon(path))).toBeTruthy();
  });
});

describe(folderIcon, () => {
  it.each([
    ["src/", "vscode-icons:folder-type-src"],
    ["tests/", "vscode-icons:folder-type-test"],
    ["docs/", "vscode-icons:folder-type-docs"],
    ["node_modules/", "vscode-icons:folder-type-node"],
    ["components/", "vscode-icons:folder-type-component"],
    [".github/", "vscode-icons:folder-type-github"],
    [".claude/", "vscode-icons:folder-type-claude"],
    ["misc/", "vscode-icons:default-folder"],
  ])("maps %s to %s", (name, expected) => {
    expect(folderIcon(name)).toBe(expected);
  });

  it.each(["whatever/", "deep/nested/", "x"])(
    "always resolves to a registered icon: %s",
    (name) => {
      expect(hasIcon(folderIcon(name))).toBeTruthy();
    }
  );
});

const render = async (src: string) => await mdxToHtml(src, builtinComponents);

describe("rendered file icons", () => {
  it("renders File rows with extension icons", async () => {
    const { body } = await render(
      '<Files><File path="a.ts" /><File path="b.py" /></Files>'
    );
    expect(body).toContain("iconify--vscode-icons");
  });

  it("renders FileRef, Tree and code headers with file icons", async () => {
    const { body } = await render(
      '<FileRef path="x.rs" />\n\n<Tree>\n\n- src/\n- app.py\n\n</Tree>\n\n```ts title="y.ts"\nz\n```'
    );
    expect(body).toContain("iconify--vscode-icons");
  });
});
