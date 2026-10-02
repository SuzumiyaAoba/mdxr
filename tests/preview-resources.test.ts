import { once } from "node:events";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ConfigOptions } from "../src/config.js";
import { createFilePreviews } from "../src/file-preview-http.js";
import { isRecord } from "../src/guards.js";
import { serveLibrary } from "../src/library.js";
import { render } from "../src/render.js";
import { serve, serveSource } from "../src/serve.js";

describe("preview configuration and resources", () => {
  const directories: string[] = [];
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(async (server) => {
        const closed = once(server, "close");
        server.closeAllConnections();
        server.close();
        await closed;
      })
    );
    await Promise.all(
      directories.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  const directory = async (): Promise<string> => {
    const dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-preview-resources-"))
    );
    directories.push(dir);
    return dir;
  };

  const baseUrl = (server: Server): string => {
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Preview is not listening");
    }
    return `http://127.0.0.1:${address.port}`;
  };

  const configuration = async (
    mode: "config" | "project"
  ): Promise<ConfigOptions> => {
    const dir = await directory();
    const config = path.join(
      dir,
      mode === "config" ? "explicit.config.mjs" : "mdxr.config.mjs"
    );
    await writeFile(
      config,
      'export default { editor: "none", theme: "theme.css" };'
    );
    await writeFile(
      path.join(dir, "theme.css"),
      ":root { --preview-resource-marker: configured; }"
    );
    return mode === "config" ? { config } : { project: dir };
  };

  it.each(["config", "project"] as const)(
    "uses the selected %s for stdin previews",
    async (mode) => {
      const dir = await directory();
      const options = await configuration(mode);
      const url = baseUrl(
        await serveSource("# Preview", 0, { ...options, dir, hydrate: false })
      );
      const response = await fetch(url);
      const html = await response.text();
      const configured = html.includes("--preview-resource-marker:configured");
      expect(configured).toBeTruthy();
    }
  );

  it.each(["config", "project"] as const)(
    "uses the selected %s for library document previews",
    async (mode) => {
      const dir = await directory();
      await writeFile(path.join(dir, "doc.mdx"), "# Preview");
      const options = await configuration(mode);
      const url = baseUrl(await serveLibrary(dir, 0, options));
      const response = await fetch(`${url}/__mdxr_library/open/doc.mdx`);
      const html = await response.text();
      const configured = html.includes("--preview-resource-marker:configured");
      expect(configured).toBeTruthy();
    }
  );

  it.each(["config", "project"] as const)(
    "uses the selected %s for referenced Markdown previews",
    async (mode) => {
      const dir = await directory();
      const file = path.join(dir, "child.md");
      await writeFile(file, "# Preview");
      const previews = createFilePreviews(await configuration(mode));
      const server = createServer((request, response) => {
        void previews.handle(request, response);
      });
      const listening = once(server, "listening");
      server.listen(0, "127.0.0.1");
      await listening;
      const url = baseUrl(server);
      const route = previews.register(file);
      expect(route).toBeDefined();
      const response = await fetch(`${url}${route}`);
      const result: unknown = await response.json();
      expect(result).toMatchObject({ kind: "markdown" });
      if (!isRecord(result) || typeof result.html !== "string") {
        throw new Error("Missing Markdown preview HTML");
      }
      const configured = result.html.includes(
        "--preview-resource-marker:configured"
      );
      expect(configured).toBeTruthy();
    }
  );

  it("reports embedded code files as renderer dependencies", async () => {
    const dir = await directory();
    const code = path.join(dir, "code.ts");
    await writeFile(code, "const answer = 42;");
    let dependencies: string[] = [];
    const html = await render('<CodeFile path="code.ts" />', {
      dir,
      hydrate: false,
      onDependencies: (files) => {
        dependencies = files;
      },
    });
    expect(html).toContain("answer");
    expect(dependencies).toContain(code);
  });

  it("embeds local images in historical document previews", async () => {
    const dir = await directory();
    const file = path.join(dir, "doc.mdx");
    await writeFile(file, "# Preview\n\n![Dot](dot.svg)");
    await writeFile(
      path.join(dir, "dot.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
    );
    const url = baseUrl(await serve(file, 0));
    const historyResponse = await fetch(`${url}/__mdxr_history`);
    const history: unknown = await historyResponse.json();
    if (!isRecord(history) || typeof history.latestId !== "string") {
      throw new Error("Missing history version");
    }
    const response = await fetch(
      `${url}/__mdxr_history?view=preview&id=${history.latestId}`
    );
    const html = await response.text();
    const embedded = html.includes('src="data:image/svg+xml;base64,');
    expect(embedded).toBeTruthy();
  });
});
