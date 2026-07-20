import { useState } from "react";
import { ChevronRight, Sparkles, Trash2 } from "lucide-react";
import type { EmbroideryElement, StitchParams, StitchType } from "@ponto-studio/shared";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible.tsx";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar.tsx";

/**
 * Tipos de ponto oferecidos como escolha nova na UI. "satin" não aparece
 * aqui — é um alias legado de "contour" (mecanicamente sempre foi
 * contour_fill, nunca cetim de verdade; ver StitchParams em packages/shared).
 * Uma parte antiga com type:"satin" é tratada como "contour" em todo lugar
 * desta tela (mesmos controles); escolher qualquer opção nova troca o tipo.
 */
const STITCH_OPTIONS: Array<{ value: Exclude<StitchType, "satin">; label: string; desc: string }> = [
  { value: "tatami", label: "Tatami", desc: "Preenchimento uniforme. Ideal para áreas grandes e cheias." },
  { value: "contour", label: "Contorno", desc: "Segue o contorno da forma, de fora pra dentro. Bom para letras e desenhos com bordas." },
  { value: "circular", label: "Circular", desc: "Espiral a partir do centro. Fica bem em formas redondas." },
  { value: "meander", label: "Meandro", desc: "Textura leve e decorativa, tipo labirinto. Bom para fundos e áreas grandes." },
  { value: "running", label: "Corrido", desc: "Contorno e detalhes finos. Ponto básico de linha." },
];

/** Constrói um StitchParams "limpo" pro novo tipo, preservando density/underlay quando fazem sentido. */
function buildStitchForType(current: StitchParams, type: Exclude<StitchType, "satin">): StitchParams {
  const density = current.density;
  const underlay = "underlay" in current ? current.underlay : undefined;
  const angle = "angle" in current && current.angle !== undefined ? current.angle : undefined;
  switch (type) {
    case "tatami":
      return { type: "tatami", density, angle: angle ?? 45, underlay };
    case "contour":
      return { type: "contour", density, underlay };
    case "meander":
      return { type: "meander", density, underlay };
    case "circular":
      return { type: "circular", density, underlay };
    case "running":
      return { type: "running", density, angle: angle ?? 0 };
  }
}

interface Props {
  element: EmbroideryElement;
  onChange: (patch: Partial<EmbroideryElement>) => void;
  onDelete: () => void;
}

export function PropertiesPanel({ element, onChange, onDelete }: Props) {
  const { stitch, color } = element;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // "satin" (legado) usa os mesmos controles de "contour" — sempre foi a mesma coisa
  const selectedOption = stitch.type === "satin" ? "contour" : stitch.type;

  function setStitch(patch: Partial<StitchParams>) {
    onChange({ stitch: { ...stitch, ...patch } as StitchParams });
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Propriedades</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3 px-2 pb-2">
        {element.stitchSuggested && (
          <p
            className="flex items-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-xs text-muted-foreground"
            title="Tipo e parâmetros escolhidos automaticamente a partir da forma desta parte. Qualquer ajuste seu substitui a sugestão."
          >
            <Sparkles className="size-3.5 shrink-0" />
            Parâmetros sugeridos automaticamente
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo de ponto</p>
          <div className="flex flex-col gap-1.5">
            {STITCH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selectedOption === opt.value
                    ? "border-primary bg-accent"
                    : "border-input bg-background hover:bg-accent/50"
                )}
                onClick={() => onChange({ stitch: buildStitchForType(stitch, opt.value), stitchSuggested: false })}
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
              onValueChange={([v]) => setStitch({ density: v! })}
            />
            <span className="w-10 shrink-0 text-xs text-muted-foreground">Denso</span>
          </div>
          <div className="text-center text-sm font-semibold text-primary">{Math.round(stitch.density * 100)}%</div>
        </div>

        {/* Ângulo — só tatami/running leem esse parâmetro no Ink/Stitch;
            contour/meander(base)/circular ignoram, então nem aparece. */}
        {(stitch.type === "tatami" || stitch.type === "running") && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ângulo</p>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-muted-foreground">0°</span>
              <Slider
                min={0}
                max={180}
                step={5}
                value={[stitch.angle]}
                onValueChange={([v]) => setStitch({ angle: v! })}
              />
              <span className="w-10 shrink-0 text-xs text-muted-foreground">180°</span>
            </div>
            <div className="text-center text-sm font-semibold text-primary">{stitch.angle}°</div>
          </div>
        )}

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
            Avançado
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-3">
            {stitch.type === "running" ? (
              <p className="text-xs text-muted-foreground">
                Ponto corrido não tem opções avançadas — é uma linha simples seguindo o contorno.
              </p>
            ) : (
              <>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={stitch.underlay ?? false}
                    onCheckedChange={(checked) => setStitch({ underlay: checked === true })}
                  />
                  <span>
                    Underlay (base)
                    <span className="block text-xs text-muted-foreground">
                      Passada de estabilização antes do preenchimento
                    </span>
                  </span>
                </label>

                {stitch.type === "tatami" && (
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
                        value={[stitch.pullCompensationMm ?? 0]}
                        onValueChange={([v]) => setStitch({ pullCompensationMm: v! })}
                      />
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">0.5mm</span>
                    </div>
                    <div className="text-center text-sm font-semibold text-primary">
                      {(stitch.pullCompensationMm ?? 0).toFixed(2)} mm
                    </div>
                  </div>
                )}

                {stitch.type === "contour" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Direção do contorno
                      </p>
                      <div className="flex flex-col gap-1">
                        {(
                          [
                            [0, "De fora pra dentro"],
                            [1, "Espiral simples"],
                            [2, "Espiral dupla"],
                          ] as const
                        ).map(([value, label]) => (
                          <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="contour-strategy"
                              className="accent-primary"
                              checked={(stitch.contourStrategy ?? 0) === value}
                              onChange={() => setStitch({ contourStrategy: value })}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        checked={stitch.avoidSelfCrossing ?? false}
                        onCheckedChange={(checked) => setStitch({ avoidSelfCrossing: checked === true })}
                      />
                      <span>
                        Evitar linha cruzando a si mesma
                        <span className="block text-xs text-muted-foreground">
                          Mais lento de gerar, resultado mais limpo em formas complexas
                        </span>
                      </span>
                    </label>
                  </>
                )}

                {stitch.type === "meander" && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ângulo do padrão
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">0°</span>
                      <Slider
                        min={0}
                        max={180}
                        step={5}
                        value={[stitch.angle ?? 0]}
                        onValueChange={([v]) => setStitch({ angle: v! })}
                      />
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">180°</span>
                    </div>
                    <div className="text-center text-sm font-semibold text-primary">{stitch.angle ?? 0}°</div>
                  </div>
                )}
              </>
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
