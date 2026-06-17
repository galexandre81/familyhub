import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import App from "./App";
import { toast, Toaster } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Erreur inattendue";
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (err) => toast(getMsg(err), { type: "error" }),
  }),
  mutationCache: new MutationCache({
    onError: (err) => toast(getMsg(err), { type: "error" }),
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
