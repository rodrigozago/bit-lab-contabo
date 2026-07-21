import React from "react";
import ReactDOM from "react-dom/client";
import { Provider as RollbarProvider, ErrorBoundary as RollbarErrorBoundary } from "@rollbar/react";
import App from "./App.tsx";
import { rollbarConfig } from "./rollbar.ts";
import "./index.css";

// RollbarProvider/ErrorBoundary: sem VITE_ROLLBAR_CLIENT_TOKEN o config vem
// `enabled: false`, então isto é inerte em dev (não manda nada). Ver rollbar.ts.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RollbarProvider config={rollbarConfig}>
      <RollbarErrorBoundary>
        <App />
      </RollbarErrorBoundary>
    </RollbarProvider>
  </React.StrictMode>
);
