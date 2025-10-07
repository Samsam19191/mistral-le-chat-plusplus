// Footer provides basic attribution and a placeholder for the repo link.
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-white/80 py-6 text-xs text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} mistral-le-chat-plusplus. All rights reserved.</p>
        <a
          href="https://github.com/your-org/mistral-le-chat-plusplus"
          className="inline-flex items-center gap-1 text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          View repository
        </a>
      </div>
    </footer>
  );
}
