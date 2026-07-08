import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth, loginUrl } from "../App";
import { Button } from "@/components/ui/button";
import { ScanFace, FolderSync, ImagePlus, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    icon: FolderSync,
    title: "O fotógrafo cria o álbum",
    text: "Ele vincula uma pasta do próprio Google Drive — as fotos originais nunca saem de lá.",
  },
  {
    icon: ScanFace,
    title: "Reconhecemos os rostos",
    text: "O sistema identifica e agrupa automaticamente as pessoas em cada foto do evento.",
  },
  {
    icon: ImagePlus,
    title: "Você recebe as suas",
    text: "Cadastre seu rosto uma vez e receba, sozinho, todas as fotos em que você aparece.",
  },
];

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
    <div className="bg-background">
      {/* Hero */}
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-2xl">
          <h1 className="text-7xl font-extrabold tracking-tighter text-foreground sm:text-8xl">FACE LAB</h1>
          <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
            Encontre suas fotos em todos os eventos. Automaticamente.
          </p>
          <div className="mt-10">
            <Button asChild size="lg">
              <a href={loginUrl("/")}>Entrar / Criar conta</a>
            </Button>
          </div>
          {authError && <p className="mt-4 text-sm text-destructive">Falha no login: {authError}</p>}
        </div>
      </div>

      {/* Como funciona */}
      <div className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="heading-editorial text-3xl sm:text-4xl">Como funciona</h2>
        <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={i}>
              <s.icon className="h-7 w-7 text-foreground" strokeWidth={1.5} />
              <p className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 font-medium">{s.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacidade */}
      <div className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-6 py-24 sm:flex-row sm:items-center">
          <ShieldCheck className="h-8 w-8 shrink-0 text-foreground" strokeWidth={1.5} />
          <div>
            <p className="font-medium">Suas fotos originais nunca saem do Google Drive do fotógrafo.</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              O Face Lab guarda só uma referência do seu rosto e miniaturas para reconhecimento — os arquivos
              originais continuam no Drive de quem organizou o evento, e você baixa direto de lá.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-10">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <p>Face Lab</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">Termos de Uso</Link>
            <Link to="/privacy" className="hover:text-foreground">Política de Privacidade</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
