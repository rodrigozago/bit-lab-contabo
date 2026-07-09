import sharp from "sharp";
import { config } from "../config.js";

// Composta em tempo de resposta (nunca bakeada no arquivo salvo pelo worker) —
// assim o toggle por álbum é instantâneo e reversível, sem reprocessar nada e
// sem precisar do original (que nunca é guardado). Cache não implementado na
// v1 (thumbs são pequenos, ~1024px); dá pra cachear o resultado em disco depois
// se o custo de CPU incomodar.

function buildTileSvg(width: number, height: number): string {
  const text = escapeXml(config.watermark.text);
  // tile diagonal repetido — contorno escuro + preenchimento claro, os dois
  // semi-transparentes, pra continuar legível tanto em fotos claras quanto escuras
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="220" height="140" patternTransform="rotate(-30)" patternUnits="userSpaceOnUse">
          <text x="0" y="70" font-family="sans-serif" font-size="22" font-weight="700"
                fill="white" fill-opacity="0.35" stroke="black" stroke-opacity="0.35" stroke-width="1">${text}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" />
    </svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** Compõe a marca d'água sobre os bytes de uma imagem (webp) e devolve webp. */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const img = sharp(imageBuffer);
  const meta = await img.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const tile = Buffer.from(buildTileSvg(width, height));
  return img.composite([{ input: tile, blend: "over" }]).webp({ quality: 82 }).toBuffer();
}
