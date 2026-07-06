import { describe, it, expect } from "vitest";
import { extractSvg } from "./svgExtractor.js";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M 0 0 Z" fill="#000"/></svg>`;

describe("extractSvg", () => {
  it("retorna o SVG quando a resposta é apenas o SVG", () => {
    expect(extractSvg(SVG)).toBe(SVG);
  });

  it("remove texto e markdown ao redor do SVG", () => {
    const text = "Claro! Aqui está o SVG:\n```xml\n" + SVG + "\n```\nEspero que ajude.";
    expect(extractSvg(text)).toBe(SVG);
  });

  it("fecha a tag quando o SVG vem truncado", () => {
    const truncated = `<svg viewBox="0 0 10 10"><path d="M 0 0 L 5 5`;
    const result = extractSvg(truncated);
    expect(result).not.toBeNull();
    expect(result!.startsWith("<svg")).toBe(true);
    expect(result!.endsWith("</svg>")).toBe(true);
  });

  it("é case-insensitive na tag svg", () => {
    const upper = `<SVG viewBox="0 0 1 1"></SVG>`;
    expect(extractSvg(upper)).toBe(upper);
  });

  it("retorna null quando não há SVG na resposta", () => {
    expect(extractSvg("Desculpe, não consigo processar essa imagem.")).toBeNull();
    expect(extractSvg("")).toBeNull();
  });
});
