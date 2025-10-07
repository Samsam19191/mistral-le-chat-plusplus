// Header displays the app name sourced from the public environment config.
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Le Chat++";

export default function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 py-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {appName}
        </h1>
        <span className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Preview
        </span>
      </div>
    </header>
  );
}
