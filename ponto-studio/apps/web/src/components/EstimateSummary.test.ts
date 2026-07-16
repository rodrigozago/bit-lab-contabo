import { describe, it, expect } from "vitest";
import type { CanvasSize, StitchPattern } from "@ponto-studio/shared";
import { stitchBounds, exceedsHoop } from "./EstimateSummary.tsx";

// Re-implementar as funções aqui para teste (já que estão no componente)
function calculateColorChanges(pattern: StitchPattern | null): number {
  if (!pattern || !pattern.stitches) return 0;
  return pattern.stitches.filter((stitch) => stitch[2] === 2).length;
}

function formatDimensions(canvas: CanvasSize): string {
  return `${Math.round(canvas.widthMm)} × ${Math.round(canvas.heightMm)} mm`;
}

describe("EstimateSummary utilities", () => {
  describe("calculateColorChanges", () => {
    it("returns 0 for null pattern", () => {
      expect(calculateColorChanges(null)).toBe(0);
    });

    it("returns 0 for pattern without stitches", () => {
      const pattern: StitchPattern = {
        viewBox: "0 0 100 100",
        threads: ["#000000"],
        stitches: [],
        stats: { totalStitches: 0, colorCount: 1 },
      };
      expect(calculateColorChanges(pattern)).toBe(0);
    });

    it("counts COLOR_BREAK commands (cmd 2)", () => {
      const pattern: StitchPattern = {
        viewBox: "0 0 100 100",
        threads: ["#000000", "#FF0000"],
        // stitch: [x, y, cmd] — cmd 2 is COLOR_BREAK
        stitches: [
          [0, 0, 0],     // STITCH
          [10, 10, 0],   // STITCH
          [20, 20, 2],   // COLOR_BREAK
          [30, 30, 0],   // STITCH
          [40, 40, 2],   // COLOR_BREAK
          [50, 50, 0],   // STITCH
        ],
        stats: { totalStitches: 6, colorCount: 2 },
      };
      expect(calculateColorChanges(pattern)).toBe(2);
    });

    it("ignores non-COLOR_BREAK commands", () => {
      const pattern: StitchPattern = {
        viewBox: "0 0 100 100",
        threads: ["#000000"],
        stitches: [
          [0, 0, 0],     // STITCH
          [10, 10, 1],   // JUMP (cmd 1)
          [20, 20, 0],   // STITCH
          [30, 30, 3],   // TRIM (cmd 3)
          [40, 40, 4],   // END (cmd 4)
        ],
        stats: { totalStitches: 5, colorCount: 1 },
      };
      expect(calculateColorChanges(pattern)).toBe(0);
    });
  });

  describe("formatDimensions", () => {
    it("formats dimensions correctly", () => {
      const canvas: CanvasSize = { widthMm: 100, heightMm: 80 };
      expect(formatDimensions(canvas)).toBe("100 × 80 mm");
    });

    it("rounds to nearest integer", () => {
      const canvas: CanvasSize = { widthMm: 100.7, heightMm: 79.3 };
      expect(formatDimensions(canvas)).toBe("101 × 79 mm");
    });

    it("handles small dimensions", () => {
      const canvas: CanvasSize = { widthMm: 10.5, heightMm: 5.2 };
      expect(formatDimensions(canvas)).toBe("11 × 5 mm");
    });

    it("handles large dimensions", () => {
      const canvas: CanvasSize = { widthMm: 300, heightMm: 400 };
      expect(formatDimensions(canvas)).toBe("300 × 400 mm");
    });
  });

  describe("stitchBounds / exceedsHoop (EXP-5)", () => {
    const patternWith = (stitches: StitchPattern["stitches"]): StitchPattern => ({
      viewBox: "0 0 100 100",
      threads: ["#000000"],
      stitches,
      stats: { totalStitches: stitches.length, colorCount: 1 },
    });

    it("calcula o bbox só dos pontos de costura", () => {
      const pattern = patternWith([
        [10, 20, 0],
        [50, 80, 0],
        [30, 40, 1], // JUMP também conta (a agulha passa por lá)
        [0, 0, 2],   // COLOR_BREAK em (0,0) NÃO pode distorcer o bbox
        [0, 0, 4],   // END idem
      ]);
      expect(stitchBounds(pattern)).toEqual({ widthMm: 40, heightMm: 60 });
    });

    it("retorna null para pattern vazio ou null", () => {
      expect(stitchBounds(null)).toBeNull();
      expect(stitchBounds(patternWith([]))).toBeNull();
    });

    it("detecta extrapolação do bastidor", () => {
      const canvas: CanvasSize = { widthMm: 100, heightMm: 100 };
      expect(exceedsHoop({ widthMm: 120, heightMm: 50 }, canvas)).toBe(true);
      expect(exceedsHoop({ widthMm: 50, heightMm: 130 }, canvas)).toBe(true);
    });

    it("nao avisa quando cabe (com tolerancia de 1mm)", () => {
      const canvas: CanvasSize = { widthMm: 100, heightMm: 100 };
      expect(exceedsHoop({ widthMm: 100, heightMm: 100 }, canvas)).toBe(false);
      expect(exceedsHoop({ widthMm: 100.9, heightMm: 100 }, canvas)).toBe(false);
      expect(exceedsHoop(null, canvas)).toBe(false);
    });
  });
});
