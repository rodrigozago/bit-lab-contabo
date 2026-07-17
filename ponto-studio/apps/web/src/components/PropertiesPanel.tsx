import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import type { EmbroideryElement, StitchType } from "@ponto-studio/shared";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar.tsx";

const STITCH_OPTIONS: Array<{ value: StitchType; label: string; desc: string }> = [
  { value: "satin", label: "Cetim", desc: "Linhas paralelas. Ótimo para letras e formas simples." },
  { value: "tatami", label: "Tatami", desc: "Preenchimento uniforme. Ideal para áreas grandes." },
  { value: "running", label: "Corrido", desc: "Contorno e detalhes. Ponto básico de linha." },
];

interface Props {
  element: EmbroideryElement;
  onChange: (patch: Partial<EmbroideryElement>) => void;
  onDelete: () => void;
}

export function PropertiesPanel({ element, onChange, onDelete }: Props) {
  const { stitch, color } = element;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const pullComp = stitch.pullCompensationMm ?? 0;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Propriedades</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3 px-2 pb-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo de ponto</p>
          <div className="flex flex-col gap-1.5">
            {STITCH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  stitch.type === opt.value
                    ? "border-primary bg-accent"
                    : "border-input bg-background hover:bg-accent/50"
                )}
                onClick={() => onChange({ stitch: { ...stitch, type: opt.value } })}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cor do fio</p>
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-10 w-10 cursor-pointer rounded-md border-0 p-0"
            />
            <span className="tabular-nums text-sm text-muted-foreground">{color.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Densidade</p>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">Esparso</span>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[stitch.density]}
              onValueChange={([v]) => onChange({ stitch: { ...stitch, density: v! } })}
            />
            <span className="w-10 shrink-0 text-xs text-muted-foreground">Denso</span>
          </div>
          <div className="text-center text-sm font-semibold text-primary">{Math.round(stitch.density * 100)}%</div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ângulo</p>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">0°</span>
            <Slider
              min={0}
              max={180}
              step={5}
              value={[stitch.angle]}
              onValueChange={([v]) => onChange({ stitch: { ...stitch, angle: v! } })}
            />
            <span className="w-10 shrink-0 text-xs text-muted-foreground">180°</span>
          </div>
          <div className="text-center text-sm font-semibold text-primary">{stitch.angle}°</div>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
            Avançado
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-3">
            {stitch.type !== "running" ? (
              <>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={stitch.underlay ?? false}
                    onCheckedChange={(checked) => onChange({ stitch: { ...stitch, underlay: checked === true } })}
                  />
                  <span>
                    Underlay (base)
                    <span className="block text-xs text-muted-foreground">
                      Passada de estabilização antes do preenchimento
                    </span>
                  </span>
                </label>

                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Compensação de puxão
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">0</span>
                    <Slider
                      min={0}
                      max={0.5}
                      step={0.05}
                      value={[pullComp]}
                      onValueChange={([v]) => onChange({ stitch: { ...stitch, pullCompensationMm: v! } })}
                    />
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">0.5mm</span>
                  </div>
                  <div className="text-center text-sm font-semibold text-primary">{pullComp.toFixed(2)} mm</div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Underlay e compensação só se aplicam a preenchimentos (cetim/tatami).
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 /> Remover área
        </Button>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
