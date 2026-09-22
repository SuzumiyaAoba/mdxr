import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";

describe("ASCII boundary cases", () => {
  it.each(["value", "defaultValue"])(
    "prefers an input's %s over its placeholder",
    async (property) => {
      const { markdown } = await mdxToAscii(
        `<Input ${property}="entered" placeholder="hint" />`
      );
      expect(markdown).toContain("entered");
      expect(markdown).not.toContain("hint");
    }
  );

  it("masks password inputs in textual output", async () => {
    const { markdown } = await mdxToAscii(
      '<Input type="password" value="private-value" />'
    );
    expect(markdown).not.toContain("private-value");
    expect(markdown).toContain("••••");
  });

  it("honors an explicitly unchecked state over the initial state", async () => {
    const { markdown } = await mdxToAscii(
      '<Checkbox checked="false" defaultChecked />'
    );
    expect(markdown).toContain("[ ]");
    expect(markdown).not.toContain("[x]");
  });

  it("renders standalone JSX containers as blocks even when authored on one line", async () => {
    const { markdown } = await mdxToAscii(
      '<Packages><Package name="kit">package note</Package></Packages>'
    );
    expect(markdown).toMatch(/\| package\s+\|/u);
    expect(markdown).toContain("package note");
  });

  it("emits referenced child anchors once when an inline renderer reads children twice", async () => {
    const { markdown } = await mdxToAscii(
      '<Ref href="/reference" title="Reference">\n\n<Theorem id="one">Body</Theorem>\n\n</Ref>'
    );
    expect(markdown.match(/id="one"/gu)).toHaveLength(1);
  });

  it.each([
    '<Approvals><Approval name="Ada">kept note</Approval></Approvals>',
    '<Stats><Stat value="1" label="Count" />\n\nkept note\n\n</Stats>',
    '<Board><Lane title="Todo">\n\nkept note\n\n</Lane></Board>',
    '<StatusPage><Service name="API">kept note</Service></StatusPage>',
    '<Benchmarks><Bench name="query" before="1" after="2" note="metadata">kept note</Bench></Benchmarks>',
    '<DbTable name="users"><DbField name="id" type="integer">kept note</DbField></DbTable>',
  ])("preserves nested report notes (%s)", async (source) => {
    const { markdown } = await mdxToAscii(source);
    expect(markdown).toContain("kept note");
  });

  it("keeps isolated graph nodes visible", async () => {
    const { markdown } = await mdxToAscii(
      '<Graph><Node id="isolated" /></Graph>'
    );
    expect(markdown).toContain("isolated");
  });

  it.each([
    '<EnvVar name="TOKEN" default="private-value" secret />',
    '<EnvVars><EnvVar name="TOKEN" default="private-value" secret /></EnvVars>',
  ])("masks secret defaults consistently with HTML (%s)", async (source) => {
    const { markdown } = await mdxToAscii(source);
    expect(markdown).not.toContain("private-value");
  });

  it("does not duplicate service percentage suffixes", async () => {
    const { markdown } = await mdxToAscii(
      '<StatusPage><Service name="API" uptime="99.98%" /></StatusPage>'
    );
    expect(markdown).toContain("99.98%");
    expect(markdown).not.toContain("99.98%%");
  });

  it.each([-10, 110])(
    "clips a slider value of %s to its track",
    async (value) => {
      const { markdown } = await mdxToAscii(`<Slider value="${value}" />`);
      expect(markdown).toContain("●");
      expect(markdown).toContain(String(value));
    }
  );

  it("handles negative OTP lengths without throwing", async () => {
    const { markdown } = await mdxToAscii(
      'Inline <InputOTP maxLength="-3" />.'
    );
    expect(markdown).toContain("[]");
  });

  it.each([-10, 110])(
    "clips waterfall spans at start %s to the visible range",
    async (start) => {
      const { markdown } = await mdxToAscii(
        `<Waterfall total="100"><Span name="request" start="${start}" duration="20" /></Waterfall>`
      );
      expect(markdown).toContain("request");
      expect(markdown).not.toContain("NaN");
    }
  );

  it("preserves unresolved prototype-named prompt variables", async () => {
    const { markdown } = await mdxToAscii(
      '<PromptTemplate template="{{constructor}} {{toString}}" />'
    );
    expect(markdown).toContain("{{constructor}} {{toString}}");
    expect(markdown).not.toContain("function Object");
  });

  it("recognizes bare dev flags in package installation commands", async () => {
    const { markdown } = await mdxToAscii(
      '<PackageInstall packages="kit" dev />'
    );
    expect(markdown).toContain("pnpm add -D kit");
  });

  it.each([
    '<Details summary="A &lt; B &amp; C">body</Details>',
    "<Accordion><AccordionItem><AccordionTrigger>A &lt; B &amp; C</AccordionTrigger><AccordionContent>body</AccordionContent></AccordionItem></Accordion>",
  ])("escapes disclosure summaries (%s)", async (source) => {
    const { markdown } = await mdxToAscii(source);
    expect(markdown).toContain("<summary>A &lt; B &amp; C</summary>");
  });

  it("retains nested HTML list structure", async () => {
    const { markdown } = await mdxToAscii(
      "<ul>\n<li>parent<ul><li>child</li></ul></li>\n</ul>"
    );
    expect(markdown).toMatch(/- parent\n\s+- child/u);
  });

  it("keeps component children embedded in ordinary prose", async () => {
    const { markdown } = await mdxToAscii(
      '<Packages>\n\nText <Package name="kept" /> continues.\n\n</Packages>'
    );
    expect(markdown).toContain("kept");
    expect(markdown).toContain("continues");
  });
});
