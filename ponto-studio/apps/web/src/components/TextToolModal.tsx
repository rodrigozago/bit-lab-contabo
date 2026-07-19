import { useEffect, useRef, useState } from "react";
import { api, pollAnalysisUntilDone } from "../api/client.ts";
import type { ImportConfirmPayload } from "./ImportModal.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

interface Props {
  onClose: () => void;
  onConfirm: (payload: ImportConfirmPayload) => void;
}

const FONTS = [
  { value: "Arial Black, sans-serif", label: "Arial Black (grosso)" },
  { value: "Georgia, serif", label: "Georgia (serifado)" },
  { value: "Impact, sans-serif", label: "Impact (condensado)" },
  { value: "Brush Script MT, cursive", label: "Brush Script (cursiva)" },
  { value: "Courier New, monospace", label: "Courier New (fino)" },
];

const PADDING = 40;
const MAX_DIMENSION = 800; // mesmo teto do worker (analyze.py MAX_DIMENSION)

export function TextToolModal({ onClose, onConfirm }: Props) {
  const [text, setText] = useState("Texto");
  const [font, setFont] = useState(FONTS[0]!.value);
  const [size, setSize] = useState(80);
  const [bold, setBold] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redesenha o preview toda vez que o texto/fonte/tamanho muda
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const fontSpec = `${bold ? "bold " : ""}${size}px ${font}`;
    ctx.font = fontSpec;
    const content = text || " ";
    const metrics = ctx.measureText(content);
    const textW = Math.max(1, Math.ceil(metrics.width));
    const textH = Math.ceil(size * 1.3); // aproximação de altura de linha

    let w = textW + PADDING * 2;
    let h = textH + PADDING * 2;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.font = fontSpec;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(content, (w / 2) / scale, (h / 2) / scale);
  }, [text, font, size, bold]);

  async function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas || !text.trim()) return;
    setLoading(true);
    setError("");

    try {
      const previewDataUrl = canvas.toDataURL("image/png");
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar a imagem do texto");

      const safeName = text.trim().slice(0, 30).replace(/[^\w\s-]/g, "") || "texto";
      const file = new File([blob], `texto-${safeName}.png`, { type: "image/png" });

      // Texto é tipicamente 1 cor/linha só — exclui fundo automaticamente,
      // mesmo pipeline (k-means + vtracer) usado pra fotos importadas.
      const { jobId } = await api.analyze.local(file, {
        colors: 1,
        minRegionPct: 0,
        detail: 2,
        colorTolerance: 10,
        maxAreas: 8,
        excludeBackground: true,
      });
      const { svg, metrics } = await pollAnalysisUntilDone(jobId);

      onConfirm({ file, result: { svg, ...(metrics ? { metrics } : {}) }, previewDataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao converter o texto em bordado");
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-5 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🔤 Adicionar texto</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="text-tool-text">Texto</Label>
          <Input
            id="text-tool-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite o texto…"
            maxLength={40}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Fonte</Label>
          <Select value={font} onValueChange={setFont}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label>Tamanho: {size}px</Label>
            <Slider min={30} max={200} step={5} value={[size]} onValueChange={([v]) => setSize(v!)} />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox checked={bold} onCheckedChange={(c) => setBold(c === true)} />
            Negrito
          </label>
        </div>

        <div className="flex min-h-[140px] max-h-[220px] items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-2">
          <canvas ref={canvasRef} className="max-h-[200px] max-w-full object-contain" />
        </div>

        {error && <p className="text-sm text-destructive">⚠ {error}</p>}

        <p className="text-xs text-primary">
          O texto é convertido em vetor pelo mesmo processo usado nas imagens importadas —
          fontes grossas (Arial Black, Impact) digitalizam melhor que traços finos.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void handleConfirm()} disabled={loading || !text.trim()}>
            {loading ? "Convertendo…" : "Adicionar ao bordado →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
