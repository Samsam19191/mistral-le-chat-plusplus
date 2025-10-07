// Chat screen scaffolding for mock streaming interactions.
import Button from "@/components/ui/button";

// TODO: integrate a `useChat` hook to orchestrate streaming updates from the mock API.
const mockMessages = [
  {
    id: "m1",
    role: "system",
    author: "System",
    content: "Welcome to Le Chat++.",
  },
  {
    id: "m2",
    role: "assistant",
    author: "Assistant",
    content: "Ask me anything about the demo.",
  },
  {
    id: "m3",
    role: "user",
    author: "You",
    content: "How will streaming work?",
  },
] as const;

export default function ChatPage() {
  return (
    <section className="space-y-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Chat Preview
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Early mock-up of the conversation flow before wiring to the streaming
          endpoint.
        </p>
      </header>

      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          <span>Session</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            connected: mock
          </span>
        </div>

        <ul className="space-y-3 text-sm">
          {mockMessages.map((message) => (
            <li
              key={message.id}
              className="rounded-md border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                <span>{message.author}</span>
                <span>{message.role}</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-200">
                {message.content}
              </p>
            </li>
          ))}
        </ul>

        <form className="space-y-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Message
            <textarea
              rows={3}
              placeholder="Type your message…"
              className="min-h-[120px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit">Send</Button>
          </div>
        </form>
      </div>
    </section>
  );
}
