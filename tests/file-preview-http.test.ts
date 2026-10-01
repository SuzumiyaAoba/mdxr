import { once } from "node:events";
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  createServer,
  IncomingMessage,
  request as httpRequest,
} from "node:http";
import type { RequestOptions, Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFilePreviews } from "../src/file-preview-http.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const jsonRecord = async (
  response: Response
): Promise<Record<string, unknown>> => {
  const value: unknown = await response.json();
  if (!isRecord(value)) {
    throw new Error("Preview response is not an object");
  }
  return value;
};

const syntaxHasTheme = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some(
    (line) =>
      Array.isArray(line) &&
      line.some(
        (token) =>
          isRecord(token) &&
          isRecord(token.style) &&
          typeof token.style["--shiki-light"] === "string"
      )
  );

const syntaxText = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((line) =>
      Array.isArray(line)
        ? line
            .filter(isRecord)
            .map((token) => (typeof token.text === "string" ? token.text : ""))
            .join("")
        : ""
    )
    .join("\n");
};

const requestStatus = async (
  url: string,
  options: RequestOptions = {}
): Promise<number> => {
  const request = httpRequest(url, options);
  const responseEvent = once(request, "response");
  request.end();
  const responseArgs: unknown = await responseEvent;
  if (!Array.isArray(responseArgs)) {
    throw new TypeError("HTTP request did not return response arguments");
  }
  const responseCandidate: unknown = responseArgs[0];
  if (!(responseCandidate instanceof IncomingMessage)) {
    throw new TypeError("HTTP request did not return a response");
  }
  const response = responseCandidate;
  const responseEnd = once(response, "end");
  response.resume();
  await responseEnd;
  return response.statusCode ?? 0;
};

describe("createFilePreviews HTTP endpoint", () => {
  const previews = createFilePreviews();
  let directory = "";
  let baseUrl = "";
  let server: Server | undefined;

  const file = (name: string): string => path.join(directory, name);

  const register = (absolutePath: string): string => {
    const route = previews.register(absolutePath);
    if (route === undefined) {
      throw new Error(`Could not register preview fixture: ${absolutePath}`);
    }
    return new URL(route, baseUrl).toString();
  };

  beforeAll(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "mdxr-file-preview-"));
    await mkdir(file("folder"));
    await writeFile(file("pixel.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(file("source.ts"), "const answer: number = 42;\n");
    await writeFile(file("note.mystery"), "plain text\nwith another line\n");
    await writeFile(
      file("article.md"),
      [
        "# Local preview",
        "",
        "![Pixel](./pixel.png)",
        "",
        '<Callout kind="note" title="Preview component">Rendered by MDXR.</Callout>',
        "",
      ].join("\n")
    );
    await writeFile(file("broken.mdx"), "<Unclosed>\n");
    await writeFile(file("binary.txt"), Buffer.from([0x66, 0x80, 0x00]));
    await writeFile(file("large.txt"), Buffer.alloc(2 * 1024 * 1024 + 1, 0x61));
    await writeFile(file("reload.txt"), "first version\n");
    await writeFile(file("deleted.txt"), "remove after registration\n");
    await writeFile(file("original-target.txt"), "original target\n");
    await writeFile(file("replacement-target.txt"), "replacement target\n");
    await symlink(file("original-target.txt"), file("replaceable.txt"));

    server = createServer((request, response) => {
      void previews.handle(request, response);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Preview test server did not bind a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 30_000);

  afterAll(async () => {
    if (server?.listening === true) {
      const closed = once(server, "close");
      server.close();
      await closed;
    }
    if (directory !== "") {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("previews images and highlights or preserves text by inferred language", async () => {
    const imageResponse = await fetch(register(file("pixel.png")));
    const image = await jsonRecord(imageResponse);

    const typedSource = "const answer: number = 42;\n";
    const typedResponse = await fetch(register(file("source.ts")));
    const typed = await jsonRecord(typedResponse);

    const plainSource = "plain text\nwith another line\n";
    const plainResponse = await fetch(register(file("note.mystery")));
    const plain = await jsonRecord(plainResponse);
    const plainStylesAreEmpty =
      Array.isArray(plain.syntax) &&
      plain.syntax.every(
        (line) =>
          Array.isArray(line) &&
          line.every(
            (token) =>
              isRecord(token) &&
              isRecord(token.style) &&
              Object.keys(token.style).length === 0
          )
      );

    expect({
      directory: previews.register(file("folder")),
      image: {
        body: image,
        status: imageResponse.status,
      },
      missing: previews.register(file("missing.txt")),
      plain: {
        kind: plain.kind,
        source: plain.source,
        status: plainResponse.status,
        stylesAreEmpty: plainStylesAreEmpty,
        syntax: syntaxText(plain.syntax),
      },
      typed: {
        hasTheme: syntaxHasTheme(typed.syntax),
        kind: typed.kind,
        source: typed.source,
        status: typedResponse.status,
        syntax: syntaxText(typed.syntax),
      },
    }).toStrictEqual({
      directory: undefined,
      image: {
        body: {
          kind: "image",
          src: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64")}`,
        },
        status: 200,
      },
      missing: undefined,
      plain: {
        kind: "text",
        source: plainSource,
        status: 200,
        stylesAreEmpty: true,
        syntax: plainSource,
      },
      typed: {
        hasTheme: true,
        kind: "text",
        source: typedSource,
        status: 200,
        syntax: typedSource,
      },
    });
  });

  it("renders Markdown with inlined relative images and keeps raw MDX on errors", async () => {
    const source = [
      "# Local preview",
      "",
      "![Pixel](./pixel.png)",
      "",
      '<Callout kind="note" title="Preview component">Rendered by MDXR.</Callout>',
      "",
    ].join("\n");
    const response = await fetch(register(file("article.md")));
    const body = await jsonRecord(response);
    if (typeof body.html !== "string") {
      throw new TypeError("Rendered Markdown response is missing HTML");
    }

    const brokenResponse = await fetch(register(file("broken.mdx")));
    const broken = await jsonRecord(brokenResponse);
    expect({
      broken: {
        hasRenderError:
          typeof broken.renderError === "string" && broken.renderError !== "",
        html: broken.html,
        kind: broken.kind,
        source: broken.source,
        status: brokenResponse.status,
      },
      markdown: {
        containsComponent: body.html.includes("Preview component"),
        containsImage: body.html.includes("data:image/png;base64,"),
        containsRenderedText: body.html.includes("Rendered by MDXR."),
        containsTitle: body.html.includes("Local preview"),
        kind: body.kind,
        source: body.source,
        status: response.status,
      },
    }).toStrictEqual({
      broken: {
        hasRenderError: true,
        html: undefined,
        kind: "markdown",
        source: "<Unclosed>\n",
        status: 200,
      },
      markdown: {
        containsComponent: true,
        containsImage: true,
        containsRenderedText: true,
        containsTitle: true,
        kind: "markdown",
        source,
        status: 200,
      },
    });
  }, 30_000);

  it("limits access to registered regular files and validates each request", async () => {
    const binaryResponse = await fetch(register(file("binary.txt")));
    expect(binaryResponse.status).toBe(415);

    const largeResponse = await fetch(register(file("large.txt")));
    expect(largeResponse.status).toBe(413);

    const deletedUrl = register(file("deleted.txt"));
    await unlink(file("deleted.txt"));
    const deletedResponse = await fetch(deletedUrl);

    const validUrl = register(file("source.ts"));
    const invalidId = new URL("/__mdxr_file", baseUrl);
    invalidId.searchParams.set("id", "../../etc/passwd");
    const invalidIdResponse = await fetch(invalidId);
    const pathInjection = new URL("/__mdxr_file", baseUrl);
    pathInjection.searchParams.set("path", "/etc/passwd");
    const pathInjectionResponse = await fetch(pathInjection);
    const tamperedPath = new URL(validUrl);
    tamperedPath.searchParams.set("path", "/etc/passwd");
    const tamperedPathResponse = await fetch(tamperedPath);
    const tamperedPathBody = await jsonRecord(tamperedPathResponse);

    const postStatus = await requestStatus(validUrl, { method: "POST" });
    const originStatus = await requestStatus(validUrl, {
      headers: { origin: "https://attacker.example" },
    });
    const hostStatus = await requestStatus(validUrl, {
      headers: { host: "attacker.example" },
    });
    const crossSiteStatus = await requestStatus(validUrl, {
      headers: { "sec-fetch-site": "cross-site" },
    });

    const symlinkUrl = register(file("replaceable.txt"));
    await unlink(file("replaceable.txt"));
    await symlink(file("replacement-target.txt"), file("replaceable.txt"));
    const symlinkResponse = await fetch(symlinkUrl);

    expect({
      statuses: [
        binaryResponse.status,
        largeResponse.status,
        deletedResponse.status,
        invalidIdResponse.status,
        pathInjectionResponse.status,
        tamperedPathResponse.status,
        postStatus,
        originStatus,
        hostStatus,
        crossSiteStatus,
        symlinkResponse.status,
      ],
      tamperedPathSource: tamperedPathBody.source,
    }).toStrictEqual({
      statuses: [415, 413, 404, 404, 404, 200, 405, 403, 403, 403, 403],
      tamperedPathSource: "const answer: number = 42;\n",
    });
  });

  it("reuses a file capability and reads the current file contents", async () => {
    const absolutePath = file("reload.txt");
    const route = previews.register(absolutePath);
    if (route === undefined) {
      throw new Error("Could not register reload fixture");
    }
    const url = new URL(route, baseUrl).toString();
    const firstResponse = await fetch(url);
    const first = await jsonRecord(firstResponse);

    await writeFile(absolutePath, "updated version\n");
    const reRegisteredRoute = previews.register(absolutePath);
    const updatedResponse = await fetch(url);
    const updated = await jsonRecord(updatedResponse);
    expect({
      first: first.source,
      routeWasReused: reRegisteredRoute === route,
      updated: updated.source,
    }).toStrictEqual({
      first: "first version\n",
      routeWasReused: true,
      updated: "updated version\n",
    });
  });
});
