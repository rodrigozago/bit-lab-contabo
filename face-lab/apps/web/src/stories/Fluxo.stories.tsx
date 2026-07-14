import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Camera, Check, ChevronLeft, ScanFace, ThumbsDown, ThumbsUp, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { GalleryCard } from "@/components/GalleryCard";

/**
 * Fluxo completo do Guest, navegável, com dados mockados — pra testar a UI
 * de ponta a ponta sem API/auth: Landing → Consent → Enroll → Galeria → Álbum.
 */
const meta: Meta = {
  title: "Fluxos/Guest — ponta a ponta",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

type Step = "landing" | "consent" | "enroll" | "galeria" | "album";

const ALBUMS = [
  { id: "1", name: "Ana & João", badge: "12 fotos com você", img: "https://picsum.photos/seed/fl-a/600/900" },
  { id: "2", name: "Formatura 2026", badge: "5 fotos com você", img: "https://picsum.photos/seed/fl-b/600/900" },
  { id: "3", name: "Aniversário Lu", badge: "8 fotos com você", img: "https://picsum.photos/seed/fl-c/600/900" },
];

const PHOTOS = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  img: `https://picsum.photos/seed/fl-p${i}/600/${i % 2 ? 400 : 800}`,
}));

function StepBar({ step, go }: { step: Step; go: (s: Step) => void }) {
  const steps: Step[] = ["landing", "consent", "enroll", "galeria", "album"];
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <span className="mr-2 text-[11px] uppercase tracking-widest text-muted-foreground">Fluxo</span>
      {steps.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => go(s)}
          className={`rounded-none px-2 py-1 text-xs uppercase tracking-wider transition-colors ${
            s === step ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function LandingStep({ next }: { next: () => void }) {
  return (
    <div className="dark-museum flex min-h-[70vh] flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <h1 className="text-6xl font-extrabold tracking-tighter sm:text-7xl">FACE LAB</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Encontre suas fotos em todos os eventos. <span className="text-accent">Automaticamente.</span>
      </p>
      <Button size="lg" className="mt-10" onClick={next}>
        Entrar / Criar conta
      </Button>
    </div>
  );
}

function ConsentStep({ next }: { next: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="heading-editorial text-3xl">Antes de continuar</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pra usar o Face Lab, você precisa concordar com os <span className="underline">Termos de Uso</span> e a{" "}
          <span className="underline">Política de Privacidade</span>.
        </p>
        <label className="mt-6 flex items-start gap-3 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          Li e concordo com os Termos de Uso e a Política de Privacidade.
        </label>
        <Button className="mt-6 w-full" disabled={!checked} onClick={next}>
          Concordo e continuar
        </Button>
      </div>
    </div>
  );
}

function EnrollStep({ next }: { next: () => void }) {
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");

  if (phase === "processing") {
    setTimeout(() => setPhase("done"), 1200);
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 text-center">
        <h3 className="text-lg font-semibold">Processando seu rosto...</h3>
        <p className="mt-2 text-sm text-muted-foreground">Isso pode levar um minuto.</p>
        <Progress className="mt-4 animate-pulse" />
      </div>
    );
  }
  if (phase === "done") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 text-center">
        <ScanFace className="mx-auto h-12 w-12 text-success-light" strokeWidth={1.5} />
        <h3 className="mt-4 text-lg font-semibold">Rosto cadastrado!</h3>
        <Button className="mt-6" onClick={next}>Ver minha galeria</Button>
      </div>
    );
  }
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6">
      <h2 className="heading-editorial text-2xl sm:text-3xl">Cadastre seu rosto</h2>
      <p className="mt-2 text-muted-foreground">
        Vamos capturar 4 fotos rápidas pela sua webcam. As imagens são descartadas em seguida.
      </p>
      <label className="mt-6 flex items-start gap-3 text-sm">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        Autorizo o processamento do meu rosto para reconhecimento facial.
      </label>
      <div className="mt-6 space-y-3">
        <Button className="w-full" disabled={!consent} onClick={() => setPhase("processing")}>
          <Camera className="mr-2 h-4 w-4" /> Ligar câmera
        </Button>
        <Button className="w-full" variant="outline" disabled={!consent} onClick={() => setPhase("processing")}>
          <Upload className="mr-2 h-4 w-4" /> Enviar fotos
        </Button>
      </div>
    </div>
  );
}

function GaleriaStep({ openAlbum }: { openAlbum: () => void }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="heading-editorial">Minhas fotos</h1>
      <p className="mt-1 text-muted-foreground">Álbuns onde te reconhecemos.</p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ALBUMS.map((a) => (
          <button key={a.id} type="button" onClick={openAlbum} className="text-left">
            <GalleryCard image={a.img} badge={a.badge} title={a.name} />
          </button>
        ))}
      </div>
    </div>
  );
}

function AlbumStep({ back }: { back: () => void }) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean | null>>({});
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <button
        type="button"
        onClick={back}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>
      <h1 className="heading-editorial mt-3">Ana & João</h1>
      <p className="mt-1 text-muted-foreground">12 fotos com você — confirme pra melhorar a precisão.</p>

      <div className="mt-8 columns-1 gap-6 sm:columns-2 xl:columns-3 [&>figure]:mb-6">
        {PHOTOS.map((p) => {
          const state = confirmed[p.id] ?? null;
          if (state === false) return null;
          return (
            <figure key={p.id} className="break-inside-avoid">
              <div className="relative overflow-hidden rounded-lg bg-secondary">
                <img src={p.img} alt="" className="block h-auto w-full" loading="lazy" />
                <div
                  className={`absolute border-2 ${
                    state
                      ? "border-accent shadow-[0_0_12px_2px_var(--accent-light)]"
                      : "border-accent-secondary/70"
                  }`}
                  style={{ left: "38%", top: "18%", width: "24%", height: "34%" }}
                />
              </div>
              <figcaption className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                {state ? (
                  <span className="flex items-center gap-1 font-medium text-success">
                    <Check size={13} /> Você
                  </span>
                ) : (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Sou eu"
                      onClick={() => setConfirmed((c) => ({ ...c, [p.id]: true }))}
                    >
                      <ThumbsUp size={14} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Não sou eu"
                      onClick={() => setConfirmed((c) => ({ ...c, [p.id]: false }))}
                    >
                      <ThumbsDown size={14} />
                    </Button>
                  </>
                )}
                <span className="flex-1" />
                <Badge variant="free">FREE</Badge>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function FluxoGuest() {
  const [step, setStep] = useState<Step>("landing");
  return (
    <div className="min-h-screen bg-background">
      <StepBar step={step} go={setStep} />
      {step === "landing" && <LandingStep next={() => setStep("consent")} />}
      {step === "consent" && <ConsentStep next={() => setStep("enroll")} />}
      {step === "enroll" && <EnrollStep next={() => setStep("galeria")} />}
      {step === "galeria" && <GaleriaStep openAlbum={() => setStep("album")} />}
      {step === "album" && <AlbumStep back={() => setStep("galeria")} />}
    </div>
  );
}

export const FluxoCompleto: Story = {
  render: () => <FluxoGuest />,
};
