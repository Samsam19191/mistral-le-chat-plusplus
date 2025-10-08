'use client';

// Button primitive that forwards refs and supports multiple variants.

import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import type React from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  children?: React.ReactNode;
}

const baseStyles =
  "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  default:
    "border-transparent bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  outline:
    "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
  ghost:
    "border-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "default", ...props },
  ref,
) {
  const resolvedClassName = `${baseStyles} ${variants[variant]} ${className}`;

  return <button ref={ref} className={resolvedClassName} {...props} />;
});

export default Button;
