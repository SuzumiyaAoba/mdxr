import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { render } from "../src/render.js";

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

  it("draws bridge totals and deltas below zero", async () => {
    const { markdown } = await mdxToAscii(
      '<Bridge><Delta name="Start" value="-10" total /><Delta name="Loss" value="-5" /><Delta name="Recovery" value="20" /></Bridge>'
    );
    expect(markdown).toMatch(/Start\s+█+\s+-10 → -10/u);
    expect(markdown).toMatch(/Loss\s+▓+\s+-5 → -15/u);
    expect(markdown).toMatch(/Recovery\s+▓+\s+\+20 → 5/u);
  });

  it("preserves the starting number of an HTML ordered list", async () => {
    const { markdown } = await mdxToAscii(
      '<ol start="5"><li>fifth</li><li>sixth</li></ol>'
    );
    expect(markdown).toContain("5. fifth");
    expect(markdown).toContain("6. sixth");
  });

  it.each([
    { expectedStart: '<ol start="-2">', start: "-2" },
    { expectedStart: '<ol start="1000000000">', start: "1000000000" },
    { expectedStart: '<ol start="999999999">', start: "999999999" },
  ])(
    "keeps HTML ordered-list start %s and its nested content in HTML",
    async ({ start, expectedStart }) => {
      const { markdown } = await mdxToAscii(
        `<ol start="${start}"><li><strong>first</strong><ul><li>child</li></ul></li><li>second</li></ol>`
      );
      expect(markdown).toContain(expectedStart);
      expect(markdown).toMatch(
        /<ol start="[^"]+">[\s\S]*<li>[\s\S]*\*\*first\*\*[\s\S]*- child[\s\S]*<\/li>[\s\S]*<\/ol>/u
      );
    }
  );

  it("renders an HTML list fallback with its nested and rich children", async () => {
    const { markdown } = await mdxToAscii(
      '<ol start="-2"><li><strong>first</strong><ul><li>child</li></ul></li><li>second</li></ol>'
    );
    const html = await render(markdown, { hydrate: false });

    expect(html).toMatch(
      /<ol start="-2">[\s\S]*<li>[\s\S]*<strong>first<\/strong>[\s\S]*<ul>[\s\S]*<li>[\s\S]*child[\s\S]*<\/li>[\s\S]*<\/ul>[\s\S]*<\/li>[\s\S]*<\/ol>/u
    );
  });

  it.each([
    { expectedFirst: "1. first", start: "1e2" },
    { expectedFirst: "1. first", start: "2147483648" },
    { expectedFirst: "5. first", start: "5junk" },
  ])(
    "matches browser integer parsing for HTML list start %s",
    async ({ start, expectedFirst }) => {
      const { markdown } = await mdxToAscii(
        `<ol start="${start}"><li>first</li><li>second</li></ol>`
      );
      expect(markdown).toContain(expectedFirst);
      expect(markdown).toContain(
        expectedFirst.startsWith("5.") ? "6. second" : "2. second"
      );
    }
  );
});
