import { useEffect, useMemo, useRef, useState } from "react";
import type { StitchPattern } from "@ponto-studio/shared";

interface Props {
  pattern: StitchPattern;
}

const SPEEDS = [0.5, 1, 2, 4];
const TARGET_SECONDS = 15; // duração aproximada de uma volta completa em 1×
const CANVAS_W = 480;
const CANVAS_H = 320;

export function StitchPlayer({ pattern }: Props) {
  const total = pattern.stitches.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0); // posição atual (fracionária durante o play)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

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

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const scale = Math.min(CANVAS_W / bbox.w, CANVAS_H / bbox.h) * 0.95;
    const offsetX = (CANVAS_W - bbox.w * scale) / 2 - bbox.x * scale;
    const offsetY = (CANVAS_H - bbox.h * scale) / 2 - bbox.y * scale;

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
  }, [pattern, index, bbox]);

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
    <div style={s.wrap}>
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={s.canvas} />

      <div style={s.stats}>
        {Math.min(Math.floor(index), total)} / {total} pontos · {pattern.stats.colorCount} cores
      </div>

      <input
        type="range"
        min={0}
        max={total}
        step={1}
        value={Math.floor(index)}
        onChange={(e) => {
          setPlaying(false);
          setIndex(Number(e.target.value));
        }}
        style={s.slider}
      />

      <div style={s.controls}>
        <button style={s.iconBtn} onClick={() => jumpToColor(-1)} title="Cor anterior">
          ◀◀
        </button>
        <button
          style={{ ...s.iconBtn, ...s.playBtn }}
          onClick={() => setPlaying((p) => !p)}
          disabled={total === 0}
        >
          {playing ? "❚❚ Pausar" : "▶ Reproduzir"}
        </button>
        <button style={s.iconBtn} onClick={() => jumpToColor(1)} title="Próxima cor">
          ▶▶
        </button>

        <div style={s.speedGroup}>
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              style={{ ...s.speedBtn, ...(speed === sp ? s.speedBtnActive : {}) }}
              onClick={() => setSpeed(sp)}
            >
              {sp}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 10 },
  canvas: {
    width: "100%", height: 220, borderRadius: 10,
    border: "1px solid #e2e0db", background: "#fafaf9",
  },
  stats: { fontSize: 12, color: "#6b6b6b", textAlign: "center" },
  slider: { width: "100%" },
  controls: {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    justifyContent: "center",
  },
  iconBtn: {
    padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e0db",
    background: "#fff", fontSize: 13, cursor: "pointer",
  },
  playBtn: {
    borderColor: "#7c5cbf", color: "#7c5cbf", fontWeight: 700, minWidth: 120,
  },
  speedGroup: { display: "flex", gap: 4, marginLeft: 8 },
  speedBtn: {
    padding: "6px 9px", borderRadius: 6, border: "1.5px solid #e2e0db",
    background: "#fff", fontSize: 12, cursor: "pointer", color: "#6b6b6b",
  },
  speedBtnActive: { borderColor: "#7c5cbf", color: "#7c5cbf", background: "#f5f0ff", fontWeight: 700 },
};
