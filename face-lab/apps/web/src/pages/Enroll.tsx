import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";

// Passos guiados de captura — o usuário se posiciona em cada ângulo
const STEPS = [
  { key: "front", label: "Olhe pra frente" },
  { key: "left", label: "Vire um pouco à esquerda" },
  { key: "right", label: "Vire um pouco à direita" },
  { key: "smile", label: "Sorria :)" },
];

type Phase = "idle" | "capturing" | "review" | "uploading" | "processing" | "done" | "error";

export function Enroll() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [frames, setFrames] = useState<Blob[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Limpeza principal ao desmontar o componente
    return () => stopCamera();
  }, [stopCamera]);

  function startCamera() {
    setError(null);
    setCameraDenied(false);
    setPhase("capturing");
    setStep(0);
    setFrames([]);
    setPreviews([]);
  }

  useEffect(() => {
    if (phase !== "capturing") {
      return;
    }

    let active = true;
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
        if (!active || !videoRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (err) {
        if (active) {
          setCameraDenied(true);
          setError("Não consegui acessar a câmera. Você pode enviar fotos suas em vez disso.");
          setPhase("error"); // Oferece uma saída clara do fluxo
        }
      }
    }

    setupCamera();

    return () => {
      active = false;
      stopCamera(); // Garante que a câmera pare ao sair da fase de captura
    };
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
    setPreviews(files.map((f) => URL.createObjectURL(f)));
    setPhase("review");
  }

  async function submit() {
    setPhase("uploading");
    setError(null);
    const fd = new FormData();
    fd.append("source", cameraDenied ? "upload" : "webcam");
    frames.forEach((f, i) => fd.append("frames", f, `frame_${i}.jpg`));
    try {
      await api<{ enrollmentId: string }>("/api/enrollment", { method: "POST", body: fd });
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
        const e = await api<{ status: string; error: string | null } | null>("/api/enrollment");
        if (e?.status === "done") {
          clearInterval(timer);
          await refresh();
          setPhase("done");
          setTimeout(() => navigate("/me"), 1200);
        } else if (e?.status === "error") {
          clearInterval(timer);
          setError(e.error ?? "não conseguimos processar seu rosto");
          setPhase("error");
        }
      } catch {
        // segue tentando
      }
    }, 2000);
  }

  function reset() {
    stopCamera();
    setPhase("idle");
    setFrames([]);
    setPreviews([]);
    setError(null);
  }

  return (
    <div className="container">
      <h1>Cadastrar meu rosto</h1>
      <p className="sub">
        Capturamos alguns ângulos do seu rosto para te reconhecer nas fotos. As imagens são usadas
        só para gerar sua referência facial — os frames originais são descartados após o processamento.
      </p>

      {error && <p className="error">{error}</p>}

      {phase === "idle" && (
        <div className="card">
          <p className="notice">Vamos capturar 4 fotos rápidas pela webcam.</p>
          <button onClick={startCamera}>Ligar câmera</button>
          <p className="notice" style={{ marginTop: 16 }}>Sem câmera? Envie de 3 a 8 fotos suas (rosto nítido, sozinho no quadro):</p>
          <input type="file" accept="image/*" multiple onChange={onFileUpload} />
        </div>
      )}

      {phase === "capturing" && (
        <div className="card webcam-stage">
          <p><strong>{STEPS[step]?.label}</strong> ({step + 1}/{STEPS.length})</p>
          <video ref={videoRef} muted playsInline />
          <div style={{ marginTop: 12 }}>
            <button onClick={captureFrame}>Capturar</button>{" "}
            <button className="ghost" onClick={reset}>Cancelar</button>
          </div>
          <div className="frames-strip">
            {previews.map((src, i) => <img key={i} src={src} alt={`frame ${i}`} />)}
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="card">
          <p><strong>Revise as capturas</strong></p>
          <div className="frames-strip">
            {previews.map((src, i) => <img key={i} src={src} alt={`frame ${i}`} />)}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={submit}>Enviar e cadastrar</button>{" "}
            <button className="ghost" onClick={reset}>Refazer</button>
          </div>
        </div>
      )}

      {(phase === "uploading" || phase === "processing") && (
        <div className="card"><p className="notice">{phase === "uploading" ? "Enviando…" : "Processando seu rosto…"}</p></div>
      )}

      {phase === "done" && (
        <div className="card"><p style={{ color: "var(--ok)" }}>Rosto cadastrado! Redirecionando…</p></div>
      )}

      {phase === "error" && <button onClick={reset}>Tentar de novo</button>}
    </div>
  );
}
