import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Rollbar from "rollbar";
import { Provider as RollbarProvider, ErrorBoundary } from "@rollbar/react";
import { App } from "./App";
import { rollbarConfig, installConsoleForwarding } from "./lib/rollbar";
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";
import "./index.css";

// instância criada fora do React pra ligar o console forwarding uma única vez,
// antes de qualquer render (erros de boot também são capturados)
const rollbar = new Rollbar(rollbarConfig);
installConsoleForwarding(rollbar);

function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-medium">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Já fomos avisados e estamos olhando. Recarregue a página pra continuar.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RollbarProvider instance={rollbar}>
      <ErrorBoundary fallbackUI={ErrorFallback}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </RollbarProvider>
  </React.StrictMode>
);
