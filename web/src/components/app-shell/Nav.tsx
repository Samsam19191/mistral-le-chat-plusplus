// Navigation exposes quick links to primary app destinations.
import Link from "next/link";

const containerClass = "mx-auto w-full max-w-5xl px-4";
const linkClass =
  "text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white";

const links = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
];

export default function Nav() {
  return (
    <nav className="bg-white/70 py-3 backdrop-blur dark:bg-zinc-950/60">
      <div className={`${containerClass} flex items-center gap-4`}>
        {links.map(({ href, label }) => (
          <Link key={href} href={href} className={linkClass}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
