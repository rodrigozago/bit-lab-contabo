import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ColorPicker } from "./color-picker.tsx";

// Sem isso, cada render() se acumula no DOM entre os testes deste arquivo
// (nenhum setup global de cleanup configurado no vite.config.ts ainda).
afterEach(cleanup);

describe("ColorPicker", () => {
  it("mostra o nome da cor (não o hex) quando o valor está na paleta", () => {
    render(<ColorPicker value="#E30613" onChange={vi.fn()} />);
    expect(screen.getByText("Vermelho")).toBeTruthy();
    expect(screen.queryByText("#E30613")).toBeNull();
  });

  it("mostra o hex como fallback quando a cor não está na paleta", () => {
    render(<ColorPicker value="#123456" onChange={vi.fn()} />);
    expect(screen.getByText("#123456")).toBeTruthy();
  });

  it("abre o popover e escolhe uma cor da paleta", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#000000" onChange={onChange} />);
    fireEvent.click(screen.getByText("Preto"));
    fireEvent.click(screen.getByTitle("Azul marinho"));
    expect(onChange).toHaveBeenCalledWith("#0D2C54");
  });

  it("mostra o campo de hex ao clicar em 'Nova cor', e só habilita confirmar com hex válido", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#000000" onChange={onChange} />);
    fireEvent.click(screen.getByText("Preto"));
    fireEvent.click(screen.getByText("Nova cor"));

    const confirmBtn = screen.getByText("Usar esta cor").closest("button") as HTMLButtonElement;
    const hexInput = screen.getByPlaceholderText("#RRGGBB");

    fireEvent.change(hexInput, { target: { value: "#ABC" } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(hexInput, { target: { value: "#AABBCC" } });
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);
    expect(onChange).toHaveBeenCalledWith("#AABBCC");
  });
});
