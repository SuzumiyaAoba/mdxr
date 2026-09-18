import { describe, expect, it } from "vitest";

import { formatError, parseErrorFormat } from "../src/format-error.js";

describe(parseErrorFormat, () => {
  it("accepts undefined, text, and json", () => {
    expect(parseErrorFormat()).toBe("text");
    expect(parseErrorFormat("text")).toBe("text");
    expect(parseErrorFormat("json")).toBe("json");
  });

  it("rejects unknown formats", () => {
    expect(() => parseErrorFormat("yaml")).toThrow(/invalid --format "yaml"/u);
  });
});

describe(formatError, () => {
  it("includes vfile-style position info when present", () => {
    const err = Object.assign(new Error("boom"), {
      column: 3,
      file: "doc.mdx",
      line: 7,
    });
    expect(formatError(err)).toBe("doc.mdx:7:3 boom");
  });

  it("stringifies non-Error values", () => {
    expect(formatError("plain")).toBe("plain");
    expect(formatError(new Error("x"))).toBe("x");
  });
});
