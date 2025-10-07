import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveMessages, loadMessages, clearMessages, KEY } from "../persist";
import type { ChatMessage } from "../types";

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe("persist", () => {
  const mockMessages: ChatMessage[] = [
    {
      id: "1",
      role: "user",
      content: "Hello",
      createdAt: 1234567890,
    },
    {
      id: "2",
      role: "assistant",
      content: "Hi there!",
      createdAt: 1234567891,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saveMessages", () => {
    it("should save messages to localStorage", () => {
      saveMessages(mockMessages);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        KEY,
        JSON.stringify(mockMessages)
      );
    });

    it("should handle JSON.stringify errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const circularMessage = { id: "1", role: "user", content: "test", createdAt: 123 } as any;
      circularMessage.circular = circularMessage; // Create circular reference

      saveMessages([circularMessage]);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to save chat messages", expect.any(Error));
      consoleSpy.mockRestore();
    });

    it("should handle localStorage.setItem errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error("Storage full");
      });

      saveMessages(mockMessages);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to save chat messages", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("loadMessages", () => {
    it("should load valid messages from localStorage", () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockMessages));

      const result = loadMessages();

      expect(localStorageMock.getItem).toHaveBeenCalledWith(KEY);
      expect(result).toEqual(mockMessages);
    });

    it("should return null when localStorage returns null", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = loadMessages();

      expect(result).toBeNull();
    });

    it("should return null when localStorage returns empty string", () => {
      localStorageMock.getItem.mockReturnValue("");

      const result = loadMessages();

      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorageMock.getItem.mockReturnValue("invalid json");

      const result = loadMessages();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load chat messages", expect.any(Error));
      consoleSpy.mockRestore();
    });

    it("should return null when data is not an array", () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ not: "array" }));

      const result = loadMessages();

      expect(result).toBeNull();
    });

    it("should return null when array contains invalid messages", () => {
      const invalidMessages = [
        { id: "1", role: "user", content: "Hello", createdAt: 123 },
        { id: 2, role: "assistant", content: "Hi", createdAt: 124 }, // invalid id type
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidMessages));

      const result = loadMessages();

      expect(result).toBeNull();
    });

    it("should return null when message has invalid role", () => {
      const invalidMessages = [
        { id: "1", role: "invalid", content: "Hello", createdAt: 123 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidMessages));

      const result = loadMessages();

      expect(result).toBeNull();
    });

    it("should handle localStorage.getItem errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      const result = loadMessages();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load chat messages", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("clearMessages", () => {
    it("should remove messages from localStorage", () => {
      clearMessages();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(KEY);
    });

    it("should handle localStorage.removeItem errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      clearMessages();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to clear chat messages", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});