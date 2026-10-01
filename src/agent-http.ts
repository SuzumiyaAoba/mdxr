import type http from "node:http";

import { renderAgentMarkdown } from "./agent-markdown.js";
import type { createAgentSession } from "./agent-session.js";
import { formatError } from "./format-error.js";
import { isLocalOrigin, replyJson } from "./local-http.js";

type AgentSession = ReturnType<typeof createAgentSession>;

const view = (conversation: Awaited<ReturnType<AgentSession["current"]>>) => ({
  ...conversation,
  messages: conversation.messages.map((message) => ({
    ...message,
    html: renderAgentMarkdown(message.content),
  })),
  sessionId: conversation.sessionId ?? null,
});

const readMessage = async (req: http.IncomingMessage): Promise<string> => {
  const contentType = req.headers["content-type"]
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new Error("Expected application/json");
  }
  let source = "";
  for await (const chunk of req) {
    source += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk);
    if (source.length > 65_536) {
      throw new Error("Message is too large");
    }
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Invalid JSON");
  }
  const message =
    typeof value === "object" && value !== null && "message" in value
      ? value.message
      : undefined;
  if (
    typeof message !== "string" ||
    message.trim() === "" ||
    message.length > 65_536
  ) {
    throw new Error("Expected a non-empty message");
  }
  return message;
};

const errorStatus = (detail: string): number => {
  if (detail === "Agent is already responding") {
    return 409;
  }
  if (detail === "Message is too large") {
    return 413;
  }
  if (
    detail === "Expected application/json" ||
    detail === "Invalid JSON" ||
    detail === "Expected a non-empty message"
  ) {
    return 400;
  }
  return 500;
};

/** Local-only JSON endpoint for one served document's agent conversation. */
export const handleAgentRequest = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  agent: AgentSession | undefined,
  notify: () => void,
  beforeSend?: () => Promise<void>
): Promise<void> => {
  let started = false;
  try {
    if (agent === undefined) {
      replyJson(res, 404, { error: "Agent chat is disabled" });
      return;
    }
    if (!isLocalOrigin(req)) {
      replyJson(res, 403, { error: "Request origin is not allowed" });
      return;
    }
    if (req.method === "GET") {
      replyJson(res, 200, view(await agent.current()));
      return;
    }
    if (req.method !== "POST") {
      replyJson(
        res,
        405,
        { error: "Method not allowed" },
        { allow: "GET, POST" }
      );
      return;
    }
    const message = await readMessage(req);
    await beforeSend?.();
    started = true;
    replyJson(res, 200, view(await agent.send(message)));
    notify();
  } catch (error) {
    if (started) {
      notify();
    }
    if (res.headersSent) {
      return;
    }
    const detail = formatError(error);
    replyJson(res, errorStatus(detail), { error: detail });
  }
};
