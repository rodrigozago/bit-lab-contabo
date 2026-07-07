import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth, loginUrl } from "../App";

export function Landing() {
  const { me, loading } = useAuth();
  const [params] = useSearchParams();
  const authError = params.get("authError");

  if (loading) return <div className="container notice">Carregando…</div>;

  // logado: leva direto pro que importa
  if (me) {
    return me.hasEnrollment ? <Navigate to="/me" replace /> : <Navigate to="/enroll" replace />;
  }

  return (
    <div className="hero">
      <h1>📸 Face Lab</h1>
      <p>
        Cadastre seu rosto uma vez e encontre automaticamente todas as fotos em que
        você aparece — em todos os álbuns dos eventos que você participou.
      </p>
      {authError && <p className="error">Login negado: {authError}</p>}
      <a className="btn" href={loginUrl("/")}>Entrar / Criar conta</a>
    </div>
  );
}
