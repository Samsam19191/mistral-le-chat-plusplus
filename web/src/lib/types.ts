// Chat role captures the speaker identity in a conversation.
export type ChatRole = "user" | "assistant" | "system";

// Chat message scaffold used throughout the mock UI and API interactions.
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

// Payload expected by the chat streaming endpoint.
export interface SendPayload {
  messages: Array<Pick<ChatMessage, "role" | "content">>;
  model?: string;
  temperature?: number;
}

// Stream configuration shared between client hooks and API callers.
export interface StreamSettings {
  model: string;
  temperature: number;
}

export const defaultStreamSettings: StreamSettings = {
  model: "mistral-small",
  temperature: 0.7,
};
