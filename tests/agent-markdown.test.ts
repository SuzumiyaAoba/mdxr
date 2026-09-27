import { describe, expect, it } from "vitest";

import { renderAgentMarkdown } from "../src/agent-markdown.js";

describe("agent response markdown", () => {
  it("renders emphasis and inline code", () => {
    expect(renderAgentMarkdown("A **bold** and *emphasized* `value`.")).toBe(
      "<p>A <strong>bold</strong> and <em>emphasized</em> <code>value</code>.</p>"
    );
  });

  it("escapes raw HTML and MDX JSX", () => {
    const html = renderAgentMarkdown(
      '<script>alert("unsafe")</script>\n\n<Button onClick={alert(1)}>Run</Button>'
    );

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Button");
    expect(html).toContain("&lt;/script&gt;");
    expect(html).not.toMatch(/<(?:script|Button)\b/u);
  });

  it("removes javascript links while keeping their text", () => {
    const scheme = ["java", "script"].join("");
    const html = renderAgentMarkdown(`[run](${scheme}:alert(1))`);

    expect(html).toBe("<p>run</p>");
    expect(html).not.toContain(scheme);
    expect(html).not.toContain("<a ");
  });

  it("preserves the starting number of ordered lists", () => {
    expect(renderAgentMarkdown("5. fifth\n6. sixth")).toContain(
      '<ol start="5">'
    );
  });
});
