// Pré-renderiza SÓ a rota "/" (landing) pro dist/index.html, rodando via
// vite-node (Node puro, sem browser/DOM). Renderiza o <App/> inteiro (não só
// <LandingPage/> isolado) dentro da MESMA árvore de providers que main.tsx
// usa no client — StrictMode > RollbarProvider > RollbarErrorBoundary >
// Router > App — trocando só BrowserRouter por StaticRouter (location="/").
//
// Por quê a árvore precisa bater exatamente: o Radix (Accordion do FAQ,
// Sheet do menu mobile) usa useId() pra gerar ids estáveis de acessibilidade;
// esse id depende da posição do componente na árvore de fibers, não só do
// HTML final. Uma primeira versão deste script renderizava só
// <ThemeProvider><LandingPage/></ThemeProvider> isolado — o HTML parecia
// certo, mas hidratar gerava ids diferentes dos do client (menos componentes
// "por fora" no passe do servidor) e o React descartava tudo com os erros
// #418/#423 (hydration failed). Renderizar o <App/> completo elimina isso.
//
// EditorRoute/Home (que puxam @tldraw/tldraw via Editor.tsx, incompatível
// com Node) são lazy() dentro de App.tsx — como só a rota "/" é resolvida
// aqui, esse import() nunca roda, mas o import ESTÁTICO no topo do arquivo
// já teria carregado e quebrado o build se não fossem lazy.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Provider as RollbarProvider, ErrorBoundary as RollbarErrorBoundary } from "@rollbar/react";
import App from "../src/App.tsx";
import { rollbarConfig } from "../src/rollbar.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distIndexPath = resolve(__dirname, "../dist/index.html");

if (!existsSync(distIndexPath)) {
  console.error(`[prerender] ${distIndexPath} não existe — rode "vite build" antes.`);
  process.exit(1);
}

const rootHtml = renderToString(
  <React.StrictMode>
    <RollbarProvider config={rollbarConfig}>
      <RollbarErrorBoundary>
        <StaticRouter location="/">
          <App />
        </StaticRouter>
      </RollbarErrorBoundary>
    </RollbarProvider>
  </React.StrictMode>
);

const template = readFileSync(distIndexPath, "utf-8");
const marker = '<div id="root"></div>';
if (!template.includes(marker)) {
  console.error(`[prerender] Não achei ${JSON.stringify(marker)} em dist/index.html — layout do index.html mudou?`);
  process.exit(1);
}

const result = template.replace(marker, `<div id="root">${rootHtml}</div>`);
writeFileSync(distIndexPath, result);
console.log(`[prerender] Landing pré-renderizada em ${distIndexPath} (${rootHtml.length} chars de HTML).`);
