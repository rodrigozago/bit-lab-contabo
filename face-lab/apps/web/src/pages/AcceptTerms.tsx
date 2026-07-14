import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// gate obrigatório pós-login — App.tsx força essa rota enquanto
// me.needsTermsAcceptance for true, antes de qualquer outra página
export function AcceptTerms() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      await api("/api/me/accept-terms", { method: "POST", body: JSON.stringify({}) });
      await refresh();
      // needsTermsAcceptance vira false, mas /consent não se auto-redireciona —
      // sem isso o usuário ficava preso na mesma página após aceitar
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="heading-editorial text-3xl">Antes de continuar</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pra usar o Face Lab, você precisa concordar com os{" "}
          <Link to="/terms" target="_blank" className="underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link to="/privacy" target="_blank" className="underline">
            Política de Privacidade
          </Link>
          , que explicam como tratamos suas fotos e dados de reconhecimento facial.
        </p>

        <label className="mt-6 flex items-start gap-3 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            className="mt-0.5"
          />
          Li e concordo com os Termos de Uso e a Política de Privacidade.
        </label>

        <Button className="mt-6 w-full" disabled={!checked || loading} onClick={accept}>
          {loading ? "Confirmando…" : "Concordo e continuar"}
        </Button>
      </div>
    </div>
  );
}
