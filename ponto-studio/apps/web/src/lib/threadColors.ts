/**
 * Paleta de cores pré-definidas do seletor de "Cor do fio" (PropertiesPanel).
 * São nomes genéricos pra facilitar a escolha visual — não é um catálogo
 * oficial de marca de linha (Madeira/Isacord etc.), até termos um motivo
 * real pra mapear pra um catálogo assim. `EmbroideryElement.color` continua
 * sendo hex puro (export/worker não muda) — o nome é só apresentação.
 */
export interface ThreadColor {
  name: string;
  hex: string;
}

export const THREAD_COLORS: ThreadColor[] = [
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Preto", hex: "#000000" },
  { name: "Cinza claro", hex: "#D9D9D9" },
  { name: "Cinza", hex: "#808080" },
  { name: "Cinza chumbo", hex: "#4A4A4A" },
  { name: "Vermelho", hex: "#E30613" },
  { name: "Vinho", hex: "#7B1E3A" },
  { name: "Rosa", hex: "#F48FB1" },
  { name: "Pink", hex: "#E91E8C" },
  { name: "Laranja", hex: "#F26522" },
  { name: "Amarelo", hex: "#FFD400" },
  { name: "Amarelo ouro", hex: "#D4AF37" },
  { name: "Verde claro", hex: "#8BC34A" },
  { name: "Verde", hex: "#2E7D32" },
  { name: "Verde musgo", hex: "#556B2F" },
  { name: "Verde água", hex: "#26A69A" },
  { name: "Azul claro", hex: "#64B5F6" },
  { name: "Azul", hex: "#1565C0" },
  { name: "Azul marinho", hex: "#0D2C54" },
  { name: "Azul royal", hex: "#1E3A8A" },
  { name: "Roxo", hex: "#6A1B9A" },
  { name: "Lilás", hex: "#B39DDB" },
  { name: "Marrom", hex: "#5D4037" },
  { name: "Bege", hex: "#D2B48C" },
  { name: "Dourado", hex: "#C9A227" },
  { name: "Prata", hex: "#C0C0C0" },
];

/** Nome da cor se estiver na paleta; senão devolve o hex (cor personalizada). */
export function threadColorName(hex: string): string {
  const found = THREAD_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return found?.name ?? hex.toUpperCase();
}

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
