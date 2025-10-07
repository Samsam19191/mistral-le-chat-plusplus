'use client';

// Input primitive mirroring native inputs with shared styling and forwarded refs.

import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {}

const baseStyles =
  "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  const resolvedClassName = className
    ? `${baseStyles} ${className}`
    : baseStyles;

  return <input ref={ref} className={resolvedClassName} type={type} {...props} />;
});

export default Input;
