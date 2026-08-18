import { useState } from "react";
import { Check, Plus, ArrowLeft } from "lucide-react";
import { HEX_COLOR_RE, THREAD_COLORS, threadColorName } from "@/lib/threadColors";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

/** Seletor de cor do fio: mostra o NOME da cor (não o hex) e abre um popover
 * com swatches pré-definidos + opção de adicionar uma cor nova (aí sim entra
 * o hex, via input type=color + campo de texto). `value`/`onChange` continuam
 * trafegando hex puro — é só a apresentação que muda. */
export function ColorPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customHex, setCustomHex] = useState(value);

  const validCustomHex = HEX_COLOR_RE.test(customHex);

  function openChange(next: boolean) {
    setOpen(next);
    if (!next) setAddingCustom(false);
  }

  function pickPreset(hex: string) {
    onChange(hex);
    setOpen(false);
  }

  function startCustom() {
    setCustomHex(value);
    setAddingCustom(true);
  }

  function confirmCustom() {
    if (!validCustomHex) return;
    onChange(customHex.toUpperCase());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-md border border-input bg-background px-2.5 py-2 text-left transition-colors hover:bg-accent"
        >
          <span
            className="size-6 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm font-medium">{threadColorName(value)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        {!addingCustom ? (
          <>
            <div className="grid grid-cols-6 gap-2">
              {THREAD_COLORS.map((c) => {
                const selected = c.hex.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => pickPreset(c.hex)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
                      selected ? "border-primary" : "border-black/10"
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {selected && (
                      <Check
                        className={cn(
                          "size-3.5",
                          // contraste do check em cores claras vs escuras
                          ["#FFFFFF", "#D9D9D9", "#FFD400", "#B39DDB", "#8BC34A", "#F48FB1", "#64B5F6"].includes(c.hex)
                            ? "text-black/70"
                            : "text-white"
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={startCustom}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-input px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <Plus className="size-4" />
              Nova cor
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setAddingCustom(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Voltar pra paleta
            </button>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={validCustomHex ? customHex : value}
                onChange={(e) => setCustomHex(e.target.value)}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border-0 p-0"
              />
              <Input
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#RRGGBB"
                maxLength={7}
                className="font-mono text-sm"
                aria-invalid={customHex.length > 0 && !validCustomHex}
              />
            </div>
            <Button size="sm" onClick={confirmCustom} disabled={!validCustomHex}>
              Usar esta cor
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
