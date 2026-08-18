import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider as RollbarProvider, ErrorBoundary as RollbarErrorBoundary } from "@rollbar/react";
import App from "./App.tsx";
import { rollbarConfig } from "./rollbar.ts";
import "./index.css";

// RollbarProvider/ErrorBoundary: sem VITE_ROLLBAR_CLIENT_TOKEN o config vem
// `enabled: false`, então isto é inerte em dev (não manda nada). Ver rollbar.ts.
//
// BrowserRouter fica aqui fora (não dentro de App.tsx) de propósito: o
// scripts/prerender.tsx monta a MESMA árvore (StrictMode > RollbarProvider >
// RollbarErrorBoundary > Router > App) trocando só BrowserRouter por
// StaticRouter — se as duas árvores não baterem exatamente, o useId() do
// Radix (Accordion/Sheet) gera ids diferentes no server e no client, e a
// hidratação falha (React error #418/#423) mesmo com o conteúdo idêntico.
const app = (
  <React.StrictMode>
    <RollbarProvider config={rollbarConfig}>
      <RollbarErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RollbarErrorBoundary>
    </RollbarProvider>
  </React.StrictMode>
);

const container = document.getElementById("root")!;

// A rota "/" chega com o HTML da landing já pré-renderizado (ver
// scripts/prerender.tsx) — hidrata em vez de descartar e renderizar de novo.
// Qualquer outra rota chega com #root vazio (nunca foi pré-renderizada) e
// segue o createRoot normal, como sempre foi.
if (container.hasChildNodes()) {
  ReactDOM.hydrateRoot(container, app);
} else {
  ReactDOM.createRoot(container).render(app);
}
