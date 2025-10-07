'use client';

// Button primitive that forwards refs and will host shared styling later.

import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {}

const baseStyles =
  "inline-flex items-center justify-center rounded-md border border-transparent bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, ...props },
  ref,
) {
  const resolvedClassName = className
    ? `${baseStyles} ${className}`
    : baseStyles;

  return <button ref={ref} className={resolvedClassName} {...props} />;
});

export default Button;
