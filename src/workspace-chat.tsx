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
    <aside
      className="mdxr-workspace-chat"
      aria-label="Agent chat"
      id="mdxr-workspace-chat"
      data-mdxr-agent-panel
    >
      <div className="mdxr-workspace-chat-header">
        <div className="mdxr-workspace-chat-title">
          <h2>Agent</h2>
          <span className="mdxr-workspace-chat-provider">{providerLabel}</span>
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
        className="mdxr-workspace-chat-body"
      >
        <ConversationContent className="mdxr-workspace-conversation-content">
          {conversation === undefined &&
            (chatError === undefined || chatError === "") && (
              <output className="mdxr-workspace-loading">
                Loading conversation…
              </output>
            )}
          {conversation?.messages.length === 0 && (
            <div className="mdxr-workspace-empty">
              <strong>What would you like to change?</strong>
              <p>Ask for an edit, or send feedback from Annotate.</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              className="mdxr-workspace-message"
              data-role={message.role}
              key={messageKeys[index]}
            >
              <span className="sr-only">
                {message.role === "user" ? "You" : providerLabel}:
              </span>
              <Message
                from={message.role}
                className="mdxr-workspace-message-frame"
              >
                <MessageContent className="mdxr-workspace-message-content">
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
            <output className="mdxr-workspace-pending" aria-live="polite">
              <span aria-hidden="true" className="mdxr-workspace-pulse" />
              {sending ? "Sending…" : `Waiting for ${providerLabel}…`}
            </output>
          )}
        </ConversationContent>
      </Conversation>
      <div className="mdxr-workspace-chat-footer">
        {chatError !== undefined && chatError !== "" && (
          <p className="mdxr-workspace-error" role="alert">
            {chatError}
          </p>
        )}
        <PromptInput
          aria-label="Message composer"
          className="mdxr-workspace-composer"
          disabled={isBusy}
          onSubmit={onSend}
        >
          <PromptInputTextarea
            aria-describedby="mdxr-workspace-chat-hint"
            aria-label="Message to agent"
            className="mdxr-workspace-composer-input"
            placeholder="Describe a change…"
          />
          <PromptInputFooter className="mdxr-workspace-composer-footer">
            <span className="mdxr-workspace-hint" id="mdxr-workspace-chat-hint">
              <span>
                <kbd>Enter</kbd> to send
              </span>
              <span>
                <kbd>Shift + Enter</kbd> for a new line
              </span>
            </span>
            <PromptInputSubmit
              className="mdxr-workspace-send"
              disabled={isBusy}
              title="Send message"
            >
              <ArrowUp aria-hidden="true" size={16} strokeWidth={1.75} />
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </aside>
  );
};
