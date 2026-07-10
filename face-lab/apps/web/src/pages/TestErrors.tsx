import { useState } from "react";
import { useRollbar } from "@rollbar/react";
import { toast } from "sonner";
import { api } from "../api";
import { Button } from "@/components/ui/button";

// Página TEMPORÁRIA de teste do Rollbar (rota /erro, sem link na nav).
// Cada botão exercita um caminho diferente do SDK. Remover após validar.

function Row({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onClick}>
        Disparar
      </Button>
    </div>
  );
}

// componente que lança durante o RENDER — testa o ErrorBoundary
function RenderBomb(): JSX.Element {
  throw new Error("Erro de render de teste (ErrorBoundary)");
}

export function TestErrors() {
  const rollbar = useRollbar();
  const [explode, setExplode] = useState(false);

  if (explode) return <RenderBomb />;

  const fire = (label: string, fn: () => void) => () => {
    fn();
    toast.info(`Disparado: ${label}`, { description: "Confira o painel Items do Rollbar em alguns segundos." });
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="heading-editorial">Teste do Rollbar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Página temporária — cada botão testa um caminho diferente de captura. Os console.* respeitam o
        VITE_ROLLBAR_MIN_LEVEL configurado no build.
      </p>

      <div className="mt-8">
        <Row label="console.log" description="forwarding de console, nível info" onClick={fire("console.log", () => console.log("[teste] console.log →", { hora: new Date().toISOString() }))} />
        <Row label="console.info" description="forwarding de console, nível info" onClick={fire("console.info", () => console.info("[teste] console.info"))} />
        <Row label="console.warn" description="forwarding de console, nível warning" onClick={fire("console.warn", () => console.warn("[teste] console.warn"))} />
        <Row label="console.error" description="forwarding de console, nível error" onClick={fire("console.error", () => console.error("[teste] console.error", new Error("erro embutido no console.error")))} />
        <Row label="rollbar.info direto" description="hook useRollbar, sem passar pelo console" onClick={fire("rollbar.info", () => rollbar.info("[teste] rollbar.info manual"))} />
        <Row
          label="Erro tratado (try/catch)"
          description="rollbar.error com um Error capturado"
          onClick={fire("erro tratado", () => {
            try {
              throw new Error("Erro tratado de teste");
            } catch (err) {
              rollbar.error("[teste] erro tratado", err as Error);
            }
          })}
        />
        <Row
          label="Erro não tratado (handler)"
          description="throw dentro do onClick → captureUncaught"
          onClick={() => {
            toast.info("Disparado: throw no handler");
            setTimeout(() => {
              throw new Error("Erro não tratado de teste (handler)");
            }, 0);
          }}
        />
        <Row
          label="Promise rejeitada"
          description="rejeição sem catch → captureUnhandledRejections"
          onClick={fire("promise rejeitada", () => {
            void Promise.reject(new Error("Promise rejeitada de teste"));
          })}
        />
        <Row
          label="Erro de render"
          description="componente lança durante o render → ErrorBoundary (a tela troca pro fallback)"
          onClick={() => setExplode(true)}
        />
        <Row
          label="Erro da API (404)"
          description="chama endpoint inexistente — rejeição do fetch vira item"
          onClick={fire("api 404", () => {
            void api("/api/__teste-erro-404");
          })}
        />
        <Row
          label="Erro da API (400)"
          description="PATCH inválido — testa o caminho de erro do servidor (Rollbar da API, se ROLLBAR_SERVER_TOKEN configurado)"
          onClick={fire("api 400", () => {
            void api("/api/albums/00000000-0000-0000-0000-000000000000", { method: "PATCH", body: JSON.stringify({}) });
          })}
        />
      </div>
    </div>
  );
}
