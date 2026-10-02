import { readFileSync } from "node:fs";
import path from "node:path";

import type { AgentProvider } from "./agent-session.js";
import { inlineStyle } from "./html.js";
import { srcDir } from "./paths.js";

const css = readFileSync(path.join(srcDir, "assets", "workspace.css"), "utf-8");

/** Add the preview workspace without modifying the rendered MDX tree. */
export const injectAgentPreview = (
  html: string,
  provider?: AgentProvider
): string => {
  const agentAttributes =
    provider === undefined
      ? ""
      : ` data-doc-agent data-agent-provider="${provider}"`;
  const workspace = `<style>${inlineStyle(css)}</style><div id="doc-workspace-root"${agentAttributes}></div><script src="/__doc_workspace.js" defer></script>`;
  return html.includes("</body>")
    ? html.replace("</body>", `${workspace}</body>`)
    : `${html}${workspace}`;
};
