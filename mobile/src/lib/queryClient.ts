import { QueryClient } from '@tanstack/react-query';

// In memory only: receivables are never written to the phone's storage.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});
