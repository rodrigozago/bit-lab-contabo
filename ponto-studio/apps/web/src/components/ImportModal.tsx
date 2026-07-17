import { useRef, useState, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ArrowLeft, ChevronRight, ImagePlus, Scissors, Sparkles, Trash2 } from "lucide-react";
import { saveAnalysis, listAnalyses, removeAnalysis } from "../store/analysisCache.ts";
import type { CachedAnalysis } from "../store/analysisCache.ts";
import { api, pollAnalysisUntilDone } from "../api/client.ts";
import { normalizeSvgToFillContainer } from "../utils/svgLayers.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";

export interface AnalyzeResult {
  svg: string;
}

export interface ImportConfirmPayload {
  file: File;
  result: AnalyzeResult;
  previewDataUrl: string; // sempre disponível, seja de FileReader ou do cache
}

interface Props {
  onClose: () => void;
  onConfirm: (payload: ImportConfirmPayload) => void;
}

// Tela atual do modal
type Screen =
  | "pick"      // escolhe: cache ou nova análise
  | "upload"    // dropzone + botão analisar
  | "crop"      // recorte opcional da imagem antes da análise (IMP-6)
  | "process"   // spinner enquanto o worker processa a imagem
  | "preview";  // mostra resultado lado a lado

export function ImportModal({ onClose, onConfirm }: Props) {
  const cache = listAnalyses();
  // Se não há cache, pula direto para upload
  const [screen, setScreen] = useState<Screen>(cache.length > 0 ? "pick" : "upload");
  const [cachedList, setCachedList] = useState<CachedAnalysis[]>(cache);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parâmetros da análise local (único método — sem IA)
  const [colors, setColors] = useState(4);
  const [maxAreas, setMaxAreas] = useState(6);
  const [colorTolerance, setColorTolerance] = useState(10);
  const [excludeBackground, setExcludeBackground] = useState(true);
  const [minRegionPct, setMinRegionPct] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Recorte (IMP-6) — opcional, só para PNG/JPG (SVG não é re-analisado)
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // ── helpers ──────────────────────────────────────────────────────────────────

  function loadFile(f: File) {
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.onerror = () => {
      setFile(null);
      setPreviewUrl("");
      setError(`Não foi possível ler o arquivo "${f.name}" — ele pode estar corrompido.`);
    };
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && /image\/(png|jpeg|svg\+xml)/.test(f.type)) loadFile(f);
  }

  function handleDeleteCached(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    removeAnalysis(id);
    const updated = listAnalyses();
    setCachedList(updated);
    if (updated.length === 0) setScreen("upload");
  }

  function handleSelectCached(entry: CachedAnalysis) {
    setPreviewUrl(entry.previewDataUrl);
    setResult({ svg: entry.svg });
    setFromCache(true);
    const blob = new Blob([], { type: "image/png" });
    setFile(new File([blob], entry.fileName, { type: "image/png" }));
    setScreen("preview");
  }

  async function handleAnalyze() {
    if (!file) return;
    setError("");
    setScreen("process");
    setFromCache(false);

    try {
      const previewDataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const svg = await analyzeLocal(file);

      saveAnalysis(file, previewDataUrl, svg);
      setCachedList(listAnalyses());
      setPreviewUrl(previewDataUrl);
      setResult({ svg });
      setScreen("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setScreen("upload");
    }
  }

  async function analyzeLocal(f: File): Promise<string> {
    if (f.type === "image/svg+xml") {
      throw new Error("SVG já é vetorial — o processamento local aceita PNG ou JPG.");
    }
    const { jobId } = await api.analyze.local(f, {
      colors, minRegionPct, detail: 2, colorTolerance, maxAreas, excludeBackground,
    });
    return pollAnalysisUntilDone(jobId);
  }

  const handleConfirm = useCallback(() => {
    if (!file || !result) return;
    onConfirm({ file, result, previewDataUrl: previewUrl });
  }, [file, result, previewUrl, onConfirm]);

  // ── Recorte (IMP-6): desenha a seleção num canvas e substitui file/preview ───
  async function applyCrop() {
    const img = cropImgRef.current;
    if (!img || !file || !completedCrop || completedCrop.width < 5 || completedCrop.height < 5) return;

    // a seleção vem em px do elemento renderizado — reescala pro tamanho real
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(completedCrop.width * scaleX);
    canvas.height = Math.round(completedCrop.height * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) {
      setError("Não foi possível recortar a imagem");
      return;
    }
    // o backend e o Editor esperam um File com nome — o recorte vira PNG
    const croppedName = file.name.replace(/\.(jpe?g|png)$/i, "") + "-recorte.png";
    setFile(new File([blob], croppedName, { type: "image/png" }));
    setPreviewUrl(canvas.toDataURL("image/png"));
    setCrop(undefined);
    setCompletedCrop(null);
    setScreen("upload");
  }

  function openCrop() {
    setCrop(undefined);
    setCompletedCrop(null);
    setScreen("crop");
  }

  // ── títulos por tela ──────────────────────────────────────────────────────────
  const titles: Record<Screen, string> = {
    pick: "Importar imagem",
    upload: "Nova análise",
    crop: "Recortar imagem",
    process: "Analisando…",
    preview: "Resultado",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-2 space-y-0 border-b px-5 py-4">
          {screen !== "pick" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() =>
                setScreen(screen === "crop" ? "upload" : cachedList.length > 0 ? "pick" : "upload")
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <DialogTitle>{titles[screen]}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ═══ PICK ═══ */}
          {screen === "pick" && (
            <>
              <button
                type="button"
                className="mb-5 flex w-full items-center gap-3.5 rounded-xl border-2 border-primary bg-accent p-4 text-left"
                onClick={() => setScreen("upload")}
              >
                <Sparkles className="h-6 w-6 shrink-0 text-primary" />
                <div>
                  <div className="text-sm font-bold text-primary">Nova análise</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Processamento local — rápido, grátis, sem IA
                  </div>
                </div>
              </button>

              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Análises anteriores
              </p>
              <div className="flex flex-col gap-2">
                {cachedList.map((entry) => (
                  <div
                    key={entry.id}
                    className="relative flex cursor-pointer items-start gap-3 rounded-md border bg-muted/40 p-2.5 transition-colors hover:border-primary/40"
                    onClick={() => handleSelectCached(entry)}
                  >
                    <img
                      src={entry.previewDataUrl}
                      alt={entry.fileName}
                      className="h-12 w-16 shrink-0 rounded-md border object-cover"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold">{entry.fileName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.analyzedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      <div
                        className="mt-1 max-h-10 overflow-hidden opacity-70 [&_svg]:h-full [&_svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: normalizeSvgToFillContainer(entry.svg) }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      title="Remover do cache"
                      onClick={(e) => handleDeleteCached(e, entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ UPLOAD ═══ */}
          {screen === "upload" && (
            <>
              <div
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 px-6 py-10 text-center transition-colors",
                  dragging ? "border-primary bg-accent" : "border-border",
                  file && "border-solid border-primary py-5"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <img src={previewUrl} alt="preview" className="h-20 w-[120px] object-contain" />
                    <span className="text-sm font-semibold">{file.name}</span>
                    <span className="text-xs text-primary">Clique para trocar</span>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="h-9 w-9 text-muted-foreground" />
                    <p className="text-[15px] font-medium">Arraste uma imagem ou clique para selecionar</p>
                    <p className="text-sm text-muted-foreground">PNG, JPG, SVG — até 10 MB</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
                />
              </div>

              {file && file.type !== "image/svg+xml" && (
                <Button variant="outline" size="sm" className="mt-2.5 border-dashed text-primary" onClick={openCrop}>
                  <Scissors className="h-3.5 w-3.5" /> Recortar imagem (opcional)
                </Button>
              )}

              <div className="mt-4 flex flex-col gap-3 rounded-md border bg-muted/40 p-3.5">
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-sm">
                    Nº de cores (linhas de bordado): <strong>{colors}</strong>
                    <Slider min={1} max={8} step={1} value={[colors]} onValueChange={([v]) => setColors(v!)} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    Máximo de áreas: <strong>{maxAreas}</strong>
                    <Slider min={1} max={8} step={1} value={[maxAreas]} onValueChange={([v]) => setMaxAreas(v!)} />
                  </label>
                </div>
                <p className="text-xs text-primary">
                  Limita o total de camadas de bordado — cores parecidas demais são agrupadas até caber no limite.
                </p>

                <label className="flex cursor-pointer items-center gap-2 border-t pt-2.5 text-sm text-muted-foreground">
                  <Checkbox checked={excludeBackground} onCheckedChange={(c) => setExcludeBackground(c === true)} />
                  Remover fundo automaticamente
                </label>
                <p className="text-xs text-primary">
                  Detecta a cor de fundo (a que encosta nas bordas da imagem) e não a transforma em bordado.
                </p>

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 border-t pt-2.5 text-sm text-muted-foreground">
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
                    Opções avançadas
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5 text-sm">
                      Tolerância de cor: <strong>{colorTolerance}</strong>
                      <Slider min={0} max={40} step={1} value={[colorTolerance]} onValueChange={([v]) => setColorTolerance(v!)} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                      Ignorar detalhes pequenos: <strong>{minRegionPct.toFixed(2)}%</strong>
                      <Slider min={0} max={1} step={0.05} value={[minRegionPct]} onValueChange={([v]) => setMinRegionPct(v!)} />
                    </label>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {error && <p className="mt-2 text-sm text-destructive">⚠ {error}</p>}

              <div className="mt-5 flex justify-end gap-2.5">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleAnalyze} disabled={!file}>Processar imagem →</Button>
              </div>
            </>
          )}

          {/* ═══ CROP (IMP-6) ═══ */}
          {screen === "crop" && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Arraste pra selecionar a região que vai virar bordado — o resto da imagem é descartado.
              </p>
              <div className="flex max-h-[55vh] justify-center overflow-auto rounded-md border bg-muted/40 p-3">
                <ReactCrop crop={crop} onChange={setCrop} onComplete={setCompletedCrop}>
                  <img ref={cropImgRef} src={previewUrl} alt="recortar" className="block max-h-[50vh] max-w-full" />
                </ReactCrop>
              </div>
              <div className="mt-5 flex justify-end gap-2.5">
                <Button variant="outline" onClick={() => setScreen("upload")}>Cancelar</Button>
                <Button
                  disabled={!completedCrop || completedCrop.width < 5}
                  onClick={() => void applyCrop()}
                >
                  Aplicar recorte ✂
                </Button>
              </div>
            </>
          )}

          {/* ═══ PROCESS ═══ */}
          {screen === "process" && (
            <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
              <p className="text-[17px] font-bold">Gerando vetorial de bordado…</p>
              <p className="max-w-[360px] text-sm text-muted-foreground">Separando as cores em camadas de bordado</p>
            </div>
          )}

          {/* ═══ PREVIEW ═══ */}
          {screen === "preview" && result && (
            <>
              {fromCache && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3.5 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
                  ⚡ Resultado do cache local — nenhuma chamada à IA foi feita
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Original</p>
                  <div className="flex min-h-[200px] max-h-[300px] items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    <img src={previewUrl} alt="original" className="h-full w-full object-contain" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Vetorial gerado</p>
                  <div
                    className="flex min-h-[200px] max-h-[300px] items-center justify-center overflow-hidden rounded-md border bg-muted/40 [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: normalizeSvgToFillContainer(result.svg) }}
                  />
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-primary">Ver código SVG</summary>
                <pre className="mt-2 max-h-40 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 text-[11px]">
                  {result.svg}
                </pre>
              </details>

              <div className="mt-5 flex justify-end gap-2.5">
                <Button variant="outline" onClick={() => setScreen(cachedList.length > 0 ? "pick" : "upload")}>
                  ← Voltar
                </Button>
                <Button onClick={handleConfirm}>Incluir no bordado ✦</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
