import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { StitchPattern } from "@ponto-studio/shared";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";

interface Props {
  pattern: StitchPattern;
}

const SPEEDS = [0.5, 1, 2, 4];
const TARGET_SECONDS = 15; // duração aproximada de uma volta completa em 1×
const CANVAS_CSS_H = 220; // altura fixa em CSS; a largura acompanha o container

export function StitchPlayer({ pattern }: Props) {
  const total = pattern.stitches.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0); // posição atual (fracionária durante o play)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Resolução do canvas em px CSS reais (não um raster fixo 480×320) — sem
  // isso o browser estica o raster pra caber na caixa, distorcendo e
  // deslocando visualmente o desenho (já centralizado nas coordenadas
  // internas, mas o stretch não-uniforme quebra a centralização aparente).
  const [canvasSize, setCanvasSize] = useState({ w: 480, h: CANVAS_CSS_H });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setCanvasSize({ w, h: CANVAS_CSS_H });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // índices onde uma nova cor começa (0 + logo após cada COLOR_BREAK) — pros botões de navegar por cor
  const colorStarts = useMemo(() => {
    const idxs = [0];
    pattern.stitches.forEach((s, i) => {
      if (s[2] === 2) idxs.push(i + 1);
    });
    return idxs;
  }, [pattern]);

  // Enquadra pelo bounding box REAL dos pontos, não pelo canvas.viewBox do
  // projeto inteiro (que pode ser bem maior que o desenho) — senão um
  // desenho pequeno some minúsculo no canvas e linhas muito próximas se
  // sobrepõem visualmente, parecendo "cobrir" buracos que na verdade
  // continuam vazios nos dados.
  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pattern.stitches) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const pad = Math.max(w, h) * 0.08;
    return { x: minX - pad, y: minY - pad, w: w + pad * 2, h: h + pad * 2 };
  }, [pattern]);

  // ── animação (play/pause) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || total === 0) return;
    let raf = 0;
    let last = performance.now();
    const stitchesPerSecond = Math.max(20, total / TARGET_SECONDS) * speed;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setIndex((prev) => {
        const next = prev + stitchesPerSecond * dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);

  // ── desenho ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { w: cssW, h: cssH } = canvasSize;
    // raster em px físicos (dpr) pra ficar nítido; desenha em coordenadas CSS
    // (ctx.scale compensa) — canvas.width/height já setados via JSX abaixo.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, cssW, cssH);

    const scale = Math.min(cssW / bbox.w, cssH / bbox.h) * 0.95;
    const offsetX = (cssW - bbox.w * scale) / 2 - bbox.x * scale;
    const offsetY = (cssH - bbox.h * scale) / 2 - bbox.y * scale;

    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const limit = Math.floor(index);
    let colorIdx = 0;
    let penDown = false;
    ctx.strokeStyle = pattern.threads[0] ?? "#333333";
    ctx.beginPath();

    for (let i = 0; i <= limit && i < pattern.stitches.length; i++) {
      const [x, y, cmd] = pattern.stitches[i];
      const px = offsetX + x * scale;
      const py = offsetY + y * scale;

      if (cmd === 0) {
        if (!penDown) {
          ctx.moveTo(px, py);
          penDown = true;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        if (penDown) ctx.stroke();
        ctx.beginPath();
        penDown = false;
        if (cmd === 2) {
          colorIdx++;
          ctx.strokeStyle = pattern.threads[colorIdx] ?? pattern.threads[pattern.threads.length - 1] ?? "#333333";
        }
      }
    }
    if (penDown) ctx.stroke();
  }, [pattern, index, bbox, canvasSize, dpr]);

  function jumpToColor(direction: -1 | 1) {
    setPlaying(false);
    const cur = Math.floor(index);
    if (direction === -1) {
      const prev = [...colorStarts].reverse().find((i) => i < cur);
      setIndex(prev ?? 0);
    } else {
      const next = colorStarts.find((i) => i > cur);
      setIndex(next ?? total);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <canvas
        ref={canvasRef}
        width={Math.round(canvasSize.w * dpr)}
        height={Math.round(canvasSize.h * dpr)}
        className="h-[220px] w-full rounded-lg border bg-muted/40"
      />

      <div className="text-center text-xs text-muted-foreground">
        {Math.min(Math.floor(index), total)} / {total} pontos · {pattern.stats.colorCount} cores
      </div>

      <Slider
        min={0}
        max={total}
        step={1}
        value={[Math.floor(index)]}
        onValueChange={([v]) => {
          setPlaying(false);
          setIndex(v!);
        }}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => jumpToColor(-1)} title="Cor anterior">
          <SkipBack />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[120px] border-primary text-primary"
          onClick={() => setPlaying((p) => !p)}
          disabled={total === 0}
        >
          {playing ? (
            <>
              <Pause /> Pausar
            </>
          ) : (
            <>
              <Play /> Reproduzir
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToColor(1)} title="Próxima cor">
          <SkipForward />
        </Button>

        <div className="ml-2 flex gap-1">
          {SPEEDS.map((sp) => (
            <Button
              key={sp}
              variant="outline"
              size="sm"
              className={cn(speed === sp && "border-primary bg-accent text-primary")}
              onClick={() => setSpeed(sp)}
            >
              {sp}×
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
