import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { EnrollmentInfo } from "@face-lab/shared";
import { api } from "../api";
import { useAuth } from "../App";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Camera, CheckCircle, ScanFace, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { key: "front", label: "Olhe para a câmera" },
  { key: "left", label: "Vire um pouco à esquerda" },
  { key: "right", label: "Vire um pouco à direita" },
  { key: "smile", label: "Agora, sorria" },
];

type Phase = "idle" | "capturing" | "review" | "uploading" | "processing" | "done" | "error";

export function Enroll() {
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [frames, setFrames] = useState<Blob[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [info, setInfo] = useState<EnrollmentInfo | null>(null);
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (me?.hasEnrollment) api<EnrollmentInfo | null>("/api/enrollment").then(setInfo).catch(() => {});
  }, [me?.hasEnrollment]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  function startCamera() {
    setError(null);
    setCameraDenied(false);
    setPhase("capturing");
    setStep(0);
    setFrames([]);
    setPreviews([]);
  }

  useEffect(() => {
    if (phase !== "capturing") return;
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
      .then(stream => {
        if (!active || !videoRef.current) return stream.getTracks().forEach(t => t.stop());
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }).catch(() => {
        if (active) {
          setCameraDenied(true);
          setError("Não foi possível acessar a câmera.");
          setPhase("error");
        }
      });
    return () => { active = false; stopCamera(); };
  }, [phase, stopCamera]);

  async function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return;
    const nextFrames = [...frames, blob];
    setFrames(nextFrames);
    setPreviews((p) => [...p, URL.createObjectURL(blob)]);

    if (step + 1 >= STEPS.length) {
      stopCamera();
      setPhase("review");
    } else {
      setStep(step + 1);
    }
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setFrames(files);
    setPreviews(files.map(URL.createObjectURL));
    setPhase("review");
  }

  async function submit() {
    setPhase("uploading");
    setError(null);
    const fd = new FormData();
    fd.append("source", cameraDenied ? "upload" : "webcam");
    fd.append("consent", String(biometricConsent));
    frames.forEach((f, i) => fd.append("frames", f, `frame_${i}.jpg`));
    try {
      // Mock progress for now, as XHR is needed for real progress
      setUploadProgress(50);
      await api<{ enrollmentId: string }>("/api/enrollment", { method: "POST", body: fd });
      setUploadProgress(100);
      setPhase("processing");
      pollStatus();
    } catch (err) {
      setError(String((err as Error).message));
      setPhase("error");
    }
  }

  function pollStatus() {
    const timer = setInterval(async () => {
      try {
        const e = await api<EnrollmentInfo | null>("/api/enrollment");
        if (e?.status === "done") {
          clearInterval(timer);
          setInfo(e);
          await refresh();
          setPhase("done");
          setTimeout(() => navigate("/me"), 2000);
        } else if (e?.status === "error") {
          clearInterval(timer);
          setError(e.error ?? "Não conseguimos processar seu rosto");
          setPhase("error");
        }
      } catch { /* segue tentando */ }
    }, 2000);
  }

  async function removeEnrollment() {
    if (!info) return;
    setRemoving(true);
    try {
      await api(`/api/enrollment/${info.id}`, { method: "DELETE" });
      setInfo(null);
      await refresh();
      toast.success("Rosto removido. As fotos encontradas automaticamente pra você foram apagadas.");
    } catch (err) {
      toast.error("Não deu pra remover", { description: (err as Error).message });
    } finally {
      setRemoving(false);
    }
  }

  function reset() {
    stopCamera();
    setPhase("idle");
    setFrames([]);
    setPreviews([]);
    setError(null);
    setUploadProgress(0);
  }

  const renderContent = () => {
    switch (phase) {
      case "idle":
        if (me?.hasEnrollment && info) {
          return (
            <>
              <div className="flex items-center gap-3">
                <ScanFace className="h-8 w-8 text-success" strokeWidth={1.5} />
                <div>
                  <h2 className="heading-editorial text-2xl">Seu rosto está cadastrado</h2>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Força do perfil</span>
                  <span className="font-medium">{info.strength}%</span>
                </div>
                <Progress value={info.strength} className="mt-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Confirme mais fotos com "Sou eu" nos seus álbuns pra aumentar a precisão.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-y py-4">
                <div>
                  <p className="text-2xl font-light">{info.frameCount}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">ângulos capturados</p>
                </div>
                <div>
                  <p className="text-2xl font-light">{info.confirmedCount}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">fotos confirmadas</p>
                </div>
              </div>

              <Button className="mt-8 w-full" variant="outline" onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" /> Recadastrar rosto
              </Button>
              <button
                type="button"
                disabled={removing}
                onClick={removeEnrollment}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm text-destructive hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {removing ? "Removendo…" : "Remover meu rosto"}
              </button>
            </>
          );
        }
        return (
          <>
            <h2 className="heading-editorial text-2xl sm:text-3xl">Cadastre seu rosto</h2>
            <p className="mt-2 text-muted-foreground">
              Vamos capturar 4 fotos rápidas pela sua webcam. As imagens são usadas apenas para gerar sua referência facial e descartadas em seguida.
            </p>

            <label className="mt-6 flex items-start gap-3 text-sm">
              <Checkbox
                checked={biometricConsent}
                onCheckedChange={(v) => setBiometricConsent(v === true)}
                className="mt-0.5"
              />
              Autorizo o processamento do meu rosto para reconhecimento facial, conforme a{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
                Política de Privacidade
              </a>
              .
            </label>

            <div className="mt-6 space-y-3">
              <Button className="w-full" disabled={!biometricConsent} onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" /> Ligar câmera
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={!biometricConsent}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" /> Enviar fotos
              </Button>
              <input type="file" ref={fileInputRef} accept="image/*" multiple onChange={onFileUpload} className="hidden" />
            </div>
          </>
        );
      case "capturing":
        return (
          <>
            <div className="text-center">
              <h3 className="text-lg font-semibold">{STEPS[step]?.label}</h3>
              <p className="text-sm text-muted-foreground">{step + 1} / {STEPS.length}</p>
            </div>
            <video ref={videoRef} muted playsInline className="mt-4 w-full rounded-md border" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={captureFrame}>Capturar</Button>
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
            </div>
            {previews.length > 0 && (
                <div className="mt-4 flex justify-center gap-2">
                    {previews.map((src, i) => <img key={i} src={src} alt={`frame ${i}`} className="h-16 w-16 rounded-md border object-cover" />)}
                </div>
            )}
          </>
        );
      case "review":
        return (
          <>
            <h3 className="text-lg font-semibold">Revise as fotos</h3>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {previews.map((src, i) => <img key={i} src={src} alt={`frame ${i}`} className="w-full rounded-md border object-cover" />)}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button onClick={submit}>Enviar e cadastrar</Button>
              <Button variant="outline" onClick={reset}>Refazer</Button>
            </div>
          </>
        );
      case "uploading":
      case "processing":
        return (
            <div className="text-center">
                <h3 className="text-lg font-semibold">{phase === 'uploading' ? 'Enviando...' : 'Processando seu rosto...'}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Isso pode levar um minuto. Não feche esta página.</p>
                <Progress value={phase === 'uploading' ? uploadProgress : undefined} className={`mt-4 ${phase === 'processing' ? 'animate-pulse' : ''}`} />
            </div>
        )
      case "done":
        return (
            <div className="text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-success-light" />
                <h3 className="mt-4 text-lg font-semibold">Rosto cadastrado!</h3>
                <p className="mt-2 text-sm text-muted-foreground">Redirecionando para sua galeria...</p>
            </div>
        )
      case "error":
        return (
            <div className="text-center">
                <h3 className="text-lg font-semibold text-destructive">Ocorreu um erro</h3>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                <Button className="mt-6" onClick={reset}>Tentar de novo</Button>
            </div>
        )
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md py-4">{renderContent()}</div>
    </div>
  );
}
