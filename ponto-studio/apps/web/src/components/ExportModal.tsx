import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { CanvasSize, ExportFormat, ExportJob, StitchPattern } from "@ponto-studio/shared";
import { api, pollStitchDataUntilDone, pollUntilDone } from "../api/client.ts";
import { StitchPlayer } from "./StitchPlayer.tsx";
import { EstimateSummary, stitchBounds, exceedsHoop } from "./EstimateSummary.tsx";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

type ModalFormat = ExportFormat | "SVG";
type ExportStep = "preview" | "format" | "processing" | "done" | "error";
type PreviewPhase = "loading" | "ready" | "error";

const FORMATS: ModalFormat[] = ["DST", "PES", "JEF", "SVG"];

const FORMAT_DESC: Record<ModalFormat, string> = {
  DST: "Tajima — compatível com a maioria das máquinas",
  PES: "Brother — máquinas Brother/Babylock",
  JEF: "Janome — máquinas Janome/Elna",
  SVG: "Vetorial Ink/Stitch — download imediato, abre no Inkscape",
};

interface Props {
  projectId: string;
  canvas: CanvasSize;
  onClose: () => void;
}

export function ExportModal({ projectId, canvas, onClose }: Props) {
  const [step, setStep] = useState<ExportStep>("preview");
  const [format, setFormat] = useState<ModalFormat>("DST");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadName, setDownloadName] = useState<string | null>(null);

  // Player de simulação (EXP-2)
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("loading");
  const [previewError, setPreviewError] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [pattern, setPattern] = useState<StitchPattern | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreviewPhase("loading");
    (async () => {
      try {
        const { jobId } = await api.stitchPreview.create(projectId);
        const result = await pollStitchDataUntilDone(jobId);
        if (!cancelled) {
          setPattern(result);
          setPreviewPhase("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : "erro desconhecido");
          setPreviewPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, previewAttempt]);

  // Exportação SVG é síncrona: a API devolve o arquivo direto (sem worker)
  async function exportSvg() {
    const res = await fetch("/api/export/svg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) throw new Error(`Falha na exportação (HTTP ${res.status})`);

    const disposition = res.headers.get("content-disposition") ?? "";
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "bordado.svg";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const now = new Date().toISOString();
    setJob({
      jobId: "svg-local", projectId, format: "DST", status: "done",
      downloadUrl: url, createdAt: now, updatedAt: now,
    });
    setDownloadName(fileName);
  }

  async function handleExport() {
    setStep("processing");
    try {
      if (format === "SVG") {
        await exportSvg();
      } else {
        const created = await api.export.create({ projectId, format });
        setJob(created);
        const finished = await pollUntilDone(created.jobId, setJob);
        setJob(finished);
      }
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  }

  function handleFormatSelected() {
    setStep("format");
  }

  function handleBackToPreview() {
    setStep("preview");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar Bordado</DialogTitle>
        </DialogHeader>

        {/* Stepper indicator */}
        <div className="flex items-center justify-center gap-4 py-1">
          <div
            className={cn(
              "flex flex-col items-center gap-1.5 opacity-50 transition-opacity",
              (step === "preview" || step === "format" || step === "processing" || step === "done" || step === "error") &&
                "opacity-100"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
              1
            </div>
            <div className="text-center text-[11px] font-semibold text-muted-foreground">Pré-visualização</div>
          </div>
          <div className="h-0.5 w-5 bg-border" />
          <div
            className={cn(
              "flex flex-col items-center gap-1.5 opacity-50 transition-opacity",
              (step === "format" || step === "processing" || step === "done" || step === "error") && "opacity-100"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
              2
            </div>
            <div className="text-center text-[11px] font-semibold text-muted-foreground">Formato</div>
          </div>
        </div>

        {/* Step 1: Preview */}
        {step === "preview" && (
          <>
            {previewPhase === "loading" && (
              <div className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground">
                <div className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-[3px] border-border border-t-primary" />
                <span>Gerando pré-visualização dos pontos…</span>
              </div>
            )}
            {previewPhase === "ready" && pattern && (
              <>
                <StitchPlayer pattern={pattern} />
                <EstimateSummary pattern={pattern} canvas={canvas} />
              </>
            )}
            {previewPhase === "error" && (
              <div className="flex flex-col items-center gap-2">
                <p className="py-3 text-center text-sm text-destructive">
                  Erro ao gerar pré-visualização: {previewError}
                </p>
                <Button variant="outline" size="sm" onClick={() => setPreviewAttempt((n) => n + 1)}>
                  Tentar de novo
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleFormatSelected} disabled={previewPhase !== "ready"}>Próximo →</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Format Selection */}
        {step === "format" && (
          <>
            {exceedsHoop(stitchBounds(pattern), canvas) && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                ⚠ O desenho extrapola o bastidor — exportar mesmo assim pode não caber na máquina.
              </p>
            )}
            <p className="text-sm text-muted-foreground">Escolha o formato compatível com sua máquina:</p>
            <div className="flex flex-col gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border px-3.5 py-3 text-left transition-colors",
                    format === f ? "border-primary bg-accent" : "border-input hover:bg-accent/50"
                  )}
                  onClick={() => setFormat(f)}
                >
                  <span className="text-base font-bold">.{f}</span>
                  <span className="text-xs text-muted-foreground">{FORMAT_DESC[f]}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleBackToPreview}>← Voltar</Button>
              <Button onClick={handleExport}>Exportar .{format}</Button>
            </DialogFooter>
          </>
        )}

        {/* Processing state */}
        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-5">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-lg font-bold">Gerando arquivo de bordado…</p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {/* Done state */}
        {step === "done" && job?.downloadUrl && (
          <div className="flex flex-col items-center gap-3 py-5">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
            <p className="text-lg font-bold">Pronto!</p>
            <Button asChild size="lg">
              <a href={job.downloadUrl} download={downloadName ?? true}>
                Baixar .{format}
              </a>
            </Button>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        )}

        {/* Error state */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-5">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-bold">Erro na exportação</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
