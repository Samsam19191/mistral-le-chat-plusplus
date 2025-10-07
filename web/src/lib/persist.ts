import type { ChatMessage } from "./types";

export const KEY = "lechatpp.messages.v1";

export function saveMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify(messages);
    window.localStorage.setItem(KEY, payload);
  } catch (error) {
    console.warn("Failed to save chat messages", error);
  }
}

export function loadMessages(): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (
      parsed.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          (item.role === "user" || item.role === "assistant" || item.role === "system") &&
          typeof item.content === "string" &&
          typeof item.createdAt === "number",
      )
    ) {
      return parsed as ChatMessage[];
    }
    return null;
  } catch (error) {
    console.warn("Failed to load chat messages", error);
    return null;
  }
}

export function clearMessages(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch (error) {
    console.warn("Failed to clear chat messages", error);
  }
}
