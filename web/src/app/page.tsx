// Home page introduces the project and directs visitors to the chat preview.
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6 py-12">
      <h1 className="text-3xl font-semibold">mistral-le-chat-plusplus</h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Lightweight chat playground scaffolding. Use the link below to explore
        the chat experience.
      </p>
      <Link
        href="/chat"
        className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
      >
        Open the chat preview →
      </Link>
    </section>
  );
}
