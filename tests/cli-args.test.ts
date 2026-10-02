import { cac } from "cac";
import { describe, expect, it } from "vitest";

import { normalizeOutputArgs } from "../src/cli-args.js";

describe("stdout output arguments", () => {
  it.each(["--out", "-o"])(
    "lets CAC parse %s - while preserving stdin input",
    (option) => {
      let parsed: unknown;
      const cli = cac("mdxr");
      cli
        .command("render [file]")
        .option("-o, --out <path>", "Output path")
        .action((file: string | undefined, options: { out?: string }) => {
          parsed = { file, out: options.out };
        });
      cli.parse(
        normalizeOutputArgs(["node", "cli", "render", "-", option, "-"])
      );
      expect(parsed).toStrictEqual({ file: undefined, out: "-" });
    }
  );

  it("preserves literal arguments after the option delimiter", () => {
    const args = ["node", "cli", "render", "--", "-o", "-"];
    expect(normalizeOutputArgs(args)).toStrictEqual(args);
  });

  it("preserves ordinary output paths and attached stdout values", () => {
    const args = [
      "node",
      "cli",
      "render",
      "doc.mdx",
      "-o",
      "out.html",
      "--out=-",
    ];
    expect(normalizeOutputArgs(args)).toStrictEqual(args);
  });
});
