import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth, loginUrl } from "../App";
import { Button } from "@/components/ui/button";

export function Landing() {
  const { me, loading } = useAuth();
  const [params] = useSearchParams();
  const authError = params.get("authError");

  if (loading) {
    // Mantém a tela branca sem texto de 'carregando' para evitar um flash de conteúdo
    return <div className="min-h-screen bg-background" />;
  }

  // logado: leva direto pro que importa
  if (me) {
    return me.hasEnrollment ? <Navigate to="/me" replace /> : <Navigate to="/enroll" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col items-start">
          <h1 className="text-8xl font-extrabold tracking-tighter text-foreground">
            FACE LAB
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Encontre suas fotos em todos os eventos. Automaticamente.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <a href={loginUrl("/")}>Entrar / Criar conta</a>
            </Button>
          </div>
          {authError && <p className="mt-4 text-sm text-destructive">Falha no login: {authError}</p>}
        </div>
      </div>
    </div>
  );
}
