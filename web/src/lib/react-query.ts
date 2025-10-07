'use client';

// React Query provider sets up a shared QueryClient and devtools for the app.

import type { ReactNode } from "react";
import { useState, createElement } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 2,
  },
};

function createQueryClient() {
  return new QueryClient({ defaultOptions: defaultQueryOptions });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return createElement(
    QueryClientProvider,
    { client: queryClient },
    children,
    process.env.NODE_ENV === "development" 
      ? createElement(ReactQueryDevtools, { initialIsOpen: false })
      : null
  );
}
