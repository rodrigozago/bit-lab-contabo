import type { CanvasSize, StitchPattern } from "@ponto-studio/shared";
import { cn } from "@/lib/utils.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";

interface Props {
  pattern: StitchPattern | null;
  canvas: CanvasSize;
}

/** Calcula o número de trocas de cor (COLOR_BREAK commands) */
function calculateColorChanges(pattern: StitchPattern | null): number {
  if (!pattern || !pattern.stitches) return 0;
  return pattern.stitches.filter((stitch) => stitch[2] === 2).length;
}

/** Formata as dimensões do bastidor como "100 × 80 mm" */
function formatDimensions(canvas: CanvasSize): string {
  return `${Math.round(canvas.widthMm)} × ${Math.round(canvas.heightMm)} mm`;
}

/**
 * Bbox real dos pontos (em mm) — só comandos de costura (STITCH/JUMP com
 * coordenada real); COLOR_BREAK/END vêm em (0,0) e distorceriam o bbox.
 * É a medida fiel do que a máquina borda (EXP-5).
 */
export function stitchBounds(
  pattern: StitchPattern | null
): { widthMm: number; heightMm: number } | null {
  if (!pattern || pattern.stitches.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y, cmd] of pattern.stitches) {
    if (cmd !== 0 && cmd !== 1) continue; // só STITCH e JUMP
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return null;
  return { widthMm: maxX - minX, heightMm: maxY - minY };
}

/** True se o desenho não cabe no bastidor (tolerância de 1mm) — EXP-5 */
export function exceedsHoop(
  bounds: { widthMm: number; heightMm: number } | null,
  canvas: CanvasSize
): boolean {
  if (!bounds) return false;
  return bounds.widthMm > canvas.widthMm + 1 || bounds.heightMm > canvas.heightMm + 1;
}

export function EstimateSummary({ pattern, canvas }: Props) {
  if (!pattern) {
    return (
      <Card className="bg-muted/40">
        <CardContent className="p-3.5 text-center text-sm text-muted-foreground">
          Carregando estimativas...
        </CardContent>
      </Card>
    );
  }

  const totalStitches = pattern.stats.totalStitches;
  const colorChanges = calculateColorChanges(pattern);
  const bounds = stitchBounds(pattern);
  const overflow = exceedsHoop(bounds, canvas);
  const designSize = bounds
    ? `${Math.ceil(bounds.widthMm)} × ${Math.ceil(bounds.heightMm)} mm`
    : formatDimensions(canvas);

  return (
    <Card className="bg-muted/40">
      <CardContent className="flex flex-col gap-2.5 p-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wide">🧵 Estimativas</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-md border bg-background p-2">
            <span className="text-lg leading-none">🪡</span>
            <span className="text-[15px] font-bold">{totalStitches.toLocaleString("pt-BR")}</span>
            <span className="text-center text-[11px] text-muted-foreground">pontos</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md border bg-background p-2">
            <span className="text-lg leading-none">🔄</span>
            <span className="text-[15px] font-bold">{colorChanges}</span>
            <span className="text-center text-[11px] text-muted-foreground">trocas de cor</span>
          </div>
          <div
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border bg-background p-2",
              overflow && "border-destructive bg-destructive/5"
            )}
          >
            <span className="text-lg leading-none">📐</span>
            <span className="text-[15px] font-bold">{designSize}</span>
            <span className="text-center text-[11px] text-muted-foreground">
              desenho (bastidor {formatDimensions(canvas)})
            </span>
          </div>
        </div>
        {overflow && bounds && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs leading-relaxed text-destructive">
            ⚠ O desenho ({Math.ceil(bounds.widthMm)} × {Math.ceil(bounds.heightMm)} mm) extrapola o
            bastidor ({formatDimensions(canvas)}) — a máquina pode recusar ou cortar o bordado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
