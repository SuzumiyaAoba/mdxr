import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";

describe("ASCII uptime percentages", () => {
  it.each([
    '<Uptime pct="99.98%" />',
    '<StatusPage><Uptime pct="99.98%" /></StatusPage>',
  ])("does not duplicate the percent sign in %s", async (source) => {
    const { markdown } = await mdxToAscii(source, "uptime.mdx");

    expect(markdown).toContain("`99.98%`");
    expect(markdown).not.toContain("99.98%%");
  });

  it.each([
    '<Uptime pct="99.98" />',
    '<StatusPage><Uptime pct="99.98" /></StatusPage>',
  ])("adds a missing percent sign in %s", async (source) => {
    const { markdown } = await mdxToAscii(source, "uptime.mdx");

    expect(markdown).toContain("`99.98%`");
  });
});
