import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LabPage from "../page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const encoder = new TextEncoder();

function createMockStreamResponse(chunks: string[]) {
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => {
        controller.enqueue(encoder.encode(chunk));
      });
      controller.close();
    }
  });

  const response = new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
  Object.defineProperty(response, 'ok', { value: true });
  return Promise.resolve(response);
}

describe("LabPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the lab page component", () => {
    render(<LabPage />);
    
    expect(screen.getByText("Prompt Lab")).toBeInTheDocument();
    expect(screen.getByLabelText(/System Prompt A/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/System Prompt B/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/User Input/i)).toBeInTheDocument();
    expect(screen.getByText("Run A")).toBeInTheDocument();
    expect(screen.getByText("Run B")).toBeInTheDocument();
    expect(screen.getByText("Run Both")).toBeInTheDocument();
  });

  it("disables run buttons when user input is empty", () => {
    render(<LabPage />);
    
    expect(screen.getByRole("button", { name: "Run A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run B" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Both" })).toBeDisabled();
  });

  it("enables run buttons when user input is provided", () => {
    render(<LabPage />);
    
    const userInput = screen.getByLabelText(/User Input/i);
    fireEvent.change(userInput, { target: { value: "Test message" } });
    
    expect(screen.getByRole("button", { name: "Run A" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Run B" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Both" })).not.toBeDisabled();
  });

  it("populates both columns when Run Both is clicked", async () => {
    // Mock streaming responses for both runs
    mockFetch
      .mockImplementationOnce(() => createMockStreamResponse(["Response ", "A"]))
      .mockImplementationOnce(() => createMockStreamResponse(["Response ", "B"]));

    render(<LabPage />);
    
    // Fill in the form
    const systemPromptA = screen.getByLabelText(/System Prompt A/i);
    const systemPromptB = screen.getByLabelText(/System Prompt B/i);
    const userInput = screen.getByLabelText(/User Input/i);
    
    fireEvent.change(systemPromptA, { target: { value: "You are assistant A" } });
    fireEvent.change(systemPromptB, { target: { value: "You are assistant B" } });
    fireEvent.change(userInput, { target: { value: "Hello there" } });
    
    // Click Run Both
    const runBothButton = screen.getByRole("button", { name: "Run Both" });
    fireEvent.click(runBothButton);

    // Verify both fetch calls were made
    expect(mockFetch).toHaveBeenCalledTimes(2);
    
    // Verify the requests have the correct payloads
    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are assistant A" },
          { role: "user", content: "Hello there" }
        ]
      }),
      signal: expect.any(AbortSignal)
    });
    
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are assistant B" },
          { role: "user", content: "Hello there" }
        ]
      }),
      signal: expect.any(AbortSignal)
    });

    // Wait for the responses to populate
    await waitFor(() => {
      expect(screen.getByText("Response A")).toBeInTheDocument();
    }, { timeout: 3000 });
    
    await waitFor(() => {
      expect(screen.getByText("Response B")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("records latencies for both runs", async () => {
    mockFetch
      .mockImplementationOnce(() => createMockStreamResponse(["A"]))
      .mockImplementationOnce(() => createMockStreamResponse(["B"]));

    render(<LabPage />);
    
    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/User Input/i), { 
      target: { value: "Test" } 
    });
    
    // Click Run Both
    fireEvent.click(screen.getByRole("button", { name: "Run Both" }));

    // Wait for completion and check that some latency is displayed (with space)
    await waitFor(() => {
      const latencyElements = screen.getAllByText(/\d+ ms/);
      expect(latencyElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("clears outputs when Clear is clicked", async () => {
    mockFetch.mockImplementation(() => createMockStreamResponse(["Test output"]));

    render(<LabPage />);
    
    // Fill and run
    fireEvent.change(screen.getByLabelText(/User Input/i), { 
      target: { value: "Test" } 
    });
    fireEvent.click(screen.getByRole("button", { name: "Run A" }));

    // Wait for output
    await waitFor(() => {
      expect(screen.getByText("Test output")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Clear outputs
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Verify output is cleared
    expect(screen.queryByText("Test output")).not.toBeInTheDocument();
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<LabPage />);
    
    fireEvent.change(screen.getByLabelText(/User Input/i), { 
      target: { value: "Test" } 
    });
    fireEvent.click(screen.getByRole("button", { name: "Run A" }));

    await waitFor(() => {
      expect(screen.getByText(/\[error\] Network error/)).toBeInTheDocument();
    });
  });

  it("can export results to JSONL when records exist", async () => {
    mockFetch.mockImplementation(() => createMockStreamResponse(["Test response"]));

    render(<LabPage />);
    
    // Export should be disabled initially
    expect(screen.getByRole("button", { name: "Export JSONL" })).toBeDisabled();
    
    // Run a test to generate records
    fireEvent.change(screen.getByLabelText(/User Input/i), { 
      target: { value: "Test export" } 
    });
    fireEvent.click(screen.getByRole("button", { name: "Run A" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export JSONL" })).not.toBeDisabled();
    }, { timeout: 3000 });

    expect(screen.getByRole("button", { name: "Export JSONL" })).not.toBeDisabled();
  });
});