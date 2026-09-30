import type { AgentProvider } from "./agent-session.js";

export const validateAgentOptions = (
  agent: string | undefined,
  session: string | undefined,
  server: string | undefined
): AgentProvider | undefined => {
  if (agent !== undefined && agent !== "codex" && agent !== "claude") {
    throw new Error(`invalid --agent: ${agent} (expected codex or claude)`);
  }
  if (session !== undefined && agent === undefined) {
    throw new Error("--session requires --agent");
  }
  if (session !== undefined && agent !== "codex") {
    throw new Error("--session is only supported for codex");
  }
  if (server !== undefined && agent !== "codex") {
    throw new Error("--server requires --agent codex");
  }
  if (session !== undefined && session.trim() === "") {
    throw new Error("--session requires a non-empty ID");
  }
  return agent;
};
