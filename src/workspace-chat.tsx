import { Collapsible } from "@base-ui/react/collapsible";
import { ArrowUp, X } from "lucide-react";
import { createElement, Fragment, useMemo } from "react";
import type { ReactElement } from "react";

import {
  Conversation,
  ConversationContent,
} from "./ai-elements/conversation.js";
import { Message, MessageContent } from "./ai-elements/message.js";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./ai-elements/prompt-input.js";

export interface ChatMessage {
  content: string;
  html?: string;
  role: "user" | "assistant";
}

export interface ConversationData {
  busy: boolean;
  error?: string;
  messages: ChatMessage[];
  provider: "codex" | "claude";
  sessionId?: string | null;
}

const EMPTY_MESSAGES: ChatMessage[] = [];

interface WorkspaceChatProps {
  open: boolean;
  provider: "codex" | "claude";
  conversation?: ConversationData;
  error: string;
  sending: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

const ALLOWED_MARKDOWN_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const markdownNode = (
  node: Node,
  key: string
): ReactElement | string | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (!(node instanceof Element)) {
    return null;
  }

  const children = Array.from(node.childNodes, (child, index) =>
    markdownNode(child, `${key}-${index}`)
  );
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_MARKDOWN_TAGS.has(tag)) {
    return createElement(Fragment, { key }, ...children);
  }
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    const safeHref = /^(?:https?:|mailto:|\/|#)/iu.test(href)
      ? href
      : undefined;
    return createElement(
      "a",
      { href: safeHref, key, rel: "noopener noreferrer", target: "_blank" },
      ...children
    );
  }
  return createElement(tag, { key }, ...children);
};

const MarkdownContent = ({ html }: { html: string }) => {
  const parsed = useMemo(
    () => new DOMParser().parseFromString(html, "text/html"),
    [html]
  );
  return (
    <div>
      {Array.from(parsed.body.childNodes, (node, index) =>
        markdownNode(node, String(index))
      )}
    </div>
  );
};

const getMessageKeys = (messages: ChatMessage[]): string[] => {
  const occurrences = new Map<string, number>();
  return messages.map((message) => {
    const fingerprint = JSON.stringify([
      message.role,
      message.content,
      message.html ?? null,
    ]);
    const occurrence = occurrences.get(fingerprint) ?? 0;
    occurrences.set(fingerprint, occurrence + 1);
    return JSON.stringify([fingerprint, occurrence]);
  });
};

export const WorkspaceChat = ({
  open,
  provider,
  conversation,
  error,
  sending,
  onClose,
  onSend,
}: WorkspaceChatProps) => {
  const messages = conversation?.messages ?? EMPTY_MESSAGES;
  const messageKeys = useMemo(() => getMessageKeys(messages), [messages]);
  const providerLabel = provider === "codex" ? "Codex" : "Claude Code";
  const chatError = error || conversation?.error;
  const isBusy = sending || conversation?.busy === true;

  return (
    <Collapsible.Root open={open}>
      <Collapsible.Panel
        render={<aside />}
        className="doc-workspace-chat"
        aria-label="Agent chat"
        id="doc-workspace-chat"
        data-doc-agent-panel
        inert={!open}
      >
        <div className="doc-workspace-chat-header">
          <div className="doc-workspace-chat-title">
            <h2>Agent</h2>
            <span className="doc-workspace-chat-provider">{providerLabel}</span>
          </div>
          <button
            aria-label="Close chat"
            onClick={onClose}
            title="Close chat"
            type="button"
          >
            <X aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </div>
        <Conversation
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions"
          className="doc-workspace-chat-body"
        >
          <ConversationContent className="doc-workspace-conversation-content">
            {conversation === undefined &&
              (chatError === undefined || chatError === "") && (
                <output className="doc-workspace-loading">
                  Loading conversation…
                </output>
              )}
            {conversation?.messages.length === 0 && (
              <div className="doc-workspace-empty">
                <strong>What would you like to change?</strong>
                <p>Ask for an edit, or send feedback from Annotate.</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                className="doc-workspace-message"
                data-role={message.role}
                key={messageKeys[index]}
              >
                <span className="sr-only">
                  {message.role === "user" ? "You" : providerLabel}:
                </span>
                <Message
                  from={message.role}
                  className="doc-workspace-message-frame"
                >
                  <MessageContent className="doc-workspace-message-content">
                    {message.html === undefined ? (
                      <span className="whitespace-pre-wrap">
                        {message.content}
                      </span>
                    ) : (
                      <MarkdownContent html={message.html} />
                    )}
                  </MessageContent>
                </Message>
              </div>
            ))}
            {isBusy && (
              <output className="doc-workspace-pending" aria-live="polite">
                <span aria-hidden="true" className="doc-workspace-pulse" />
                {sending ? "Sending…" : `Waiting for ${providerLabel}…`}
              </output>
            )}
          </ConversationContent>
        </Conversation>
        <div className="doc-workspace-chat-footer">
          {chatError !== undefined && chatError !== "" && (
            <p className="doc-workspace-error" role="alert">
              {chatError}
            </p>
          )}
          <PromptInput
            aria-label="Message composer"
            className="doc-workspace-composer"
            disabled={isBusy}
            onSubmit={onSend}
          >
            <PromptInputTextarea
              aria-describedby="doc-workspace-chat-hint"
              aria-label="Message to agent"
              className="doc-workspace-composer-input"
              placeholder="Describe a change…"
            />
            <PromptInputFooter className="doc-workspace-composer-footer">
              <span className="doc-workspace-hint" id="doc-workspace-chat-hint">
                <span>
                  <kbd>Enter</kbd> to send
                </span>
                <span>
                  <kbd>Shift + Enter</kbd> for a new line
                </span>
              </span>
              <PromptInputSubmit
                className="doc-workspace-send"
                disabled={isBusy}
                title="Send message"
              >
                <ArrowUp aria-hidden="true" size={16} strokeWidth={1.75} />
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};
