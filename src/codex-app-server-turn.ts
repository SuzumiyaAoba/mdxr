import { isRecord } from "./guards.js";

export interface AgentMessageState {
  phase?: string;
  text: string;
}

export interface TurnState {
  completedTurn?: Record<string, unknown>;
  messageOrder: string[];
  messages: Map<string, AgentMessageState>;
}

export const makeTurnState = (): TurnState => ({
  messageOrder: [],
  messages: new Map(),
});

const getAgentMessage = (
  state: TurnState,
  itemId: string
): AgentMessageState => {
  let item = state.messages.get(itemId);
  if (item === undefined) {
    item = { text: "" };
    state.messages.set(itemId, item);
    state.messageOrder.push(itemId);
  }
  return item;
};

export const getNotificationTurnId = (
  params: Record<string, unknown>
): string | undefined => {
  const { turnId, turn } = params;
  if (typeof turnId === "string") {
    return turnId;
  }
  if (!isRecord(turn)) {
    return undefined;
  }
  return typeof turn.id === "string" ? turn.id : undefined;
};

export const appendAgentMessageDelta = (
  state: TurnState,
  params: Record<string, unknown>
): void => {
  const { itemId, delta } = params;
  if (typeof itemId !== "string" || typeof delta !== "string") {
    return;
  }
  getAgentMessage(state, itemId).text += delta;
};

const recordAgentMessage = (state: TurnState, item: unknown): void => {
  if (
    !isRecord(item) ||
    item.type !== "agentMessage" ||
    typeof item.id !== "string" ||
    typeof item.text !== "string"
  ) {
    return;
  }
  const agentMessage = getAgentMessage(state, item.id);
  agentMessage.text = item.text;
  if (typeof item.phase === "string") {
    agentMessage.phase = item.phase;
  }
};

export const recordCompletedAgentMessage = (
  state: TurnState,
  params: Record<string, unknown>
): void => {
  recordAgentMessage(state, params.item);
};

const recordCompletedTurnItems = (state: TurnState): void => {
  const { completedTurn } = state;
  if (!Array.isArray(completedTurn?.items)) {
    return;
  }
  for (const item of completedTurn.items) {
    recordAgentMessage(state, item);
  }
};

export const getTurnFailureMessage = (
  completedTurn: Record<string, unknown>
): string | undefined => {
  const { status, error } = completedTurn;
  if (status === "completed") {
    return undefined;
  }
  const detail = isRecord(error) ? error.message : undefined;
  return typeof detail === "string"
    ? `Codex turn ${String(status)}: ${detail}`
    : `Codex turn finished with status ${String(status)}.`;
};

export const getTurnAnswer = (
  state: TurnState
): AgentMessageState | undefined => {
  recordCompletedTurnItems(state);

  let lastMessage: AgentMessageState | undefined;
  for (let index = state.messageOrder.length - 1; index >= 0; index -= 1) {
    const itemId = state.messageOrder[index];
    if (itemId === undefined) {
      continue;
    }
    const message = state.messages.get(itemId);
    if (message === undefined) {
      continue;
    }
    lastMessage ??= message;
    if (message.phase === "final_answer") {
      return message;
    }
  }
  return lastMessage;
};
