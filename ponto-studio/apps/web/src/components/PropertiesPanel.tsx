import { useState } from "react";
import { ChevronRight, Scissors, Sparkles, Trash2 } from "lucide-react";
import { HOOP_PX_PER_MM, STROKE_FAMILY_STITCH_TYPES, type EmbroideryElement, type StitchParams, type StitchType } from "@ponto-studio/shared";
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
  { value: "zigzag", label: "Ziguezague", desc: "Linha larga em zigue-zague, largura constante. Boa para bordas grossas e traços decorativos." },
  { value: "ripple", label: "Ondulado", desc: "Cópias concêntricas ao redor do centro da forma. Fica bem em texturas tipo onda ou pétala." },
  { value: "satinColumn", label: "Cetim", desc: "Cetim de verdade, 2 trilhos com zigue-zague entre eles. Bom pra colunas/traços alongados; formas pouco alongadas caem automaticamente pro Tatami." },
];

/** Constrói um StitchParams "limpo" pro novo tipo, preservando os campos em comum quando fazem sentido. */
function buildStitchForType(current: StitchParams, type: Exclude<StitchType, "satin">): StitchParams {
  const density = current.density;
  const underlay = "underlay" in current ? current.underlay : undefined;
  const angle = "angle" in current && current.angle !== undefined ? current.angle : undefined;
  const repeats = "repeats" in current ? current.repeats : undefined;
  const beanStitchRepeats = "beanStitchRepeats" in current ? current.beanStitchRepeats : undefined;
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
      return { type: "running", density, repeats, beanStitchRepeats };
    case "zigzag":
      return { type: "zigzag", density, widthMm: "widthMm" in current ? current.widthMm : 3, repeats };
    case "ripple":
      return { type: "ripple", density, repeats, beanStitchRepeats };
    case "satinColumn":
      return {
        type: "satinColumn",
        density,
        underlay,
        pullCompensationMm: "pullCompensationMm" in current ? current.pullCompensationMm : undefined,
      };
  }
}

interface Props {
  element: EmbroideryElement;
  onChange: (patch: Partial<EmbroideryElement>) => void;
  onDelete: () => void;
  /** Nº de regiões desconectadas da parte (Fase 5) — o botão Separar só aparece com 2+. */
  regionCount?: number;
  onSplit?: () => void;
}

/** Converte mm (largura real do Ziguezague, Ink/Stitch) pro px do canvas
 * (mesma escala de HOOP_PX_PER_MM usada em todo o resto do editor), com
 * clamp na faixa que o slider "Espessura do traço" aceita (1–20px). */
function mmToStrokeWidthPx(widthMm: number): number {
  return Math.max(1, Math.min(20, Math.round(widthMm * HOOP_PX_PER_MM)));
}

export function PropertiesPanel({ element, onChange, onDelete, regionCount, onSplit }: Props) {
  const { stitch, color, simpleShape } = element;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // "satin" (legado) usa os mesmos controles de "contour" — sempre foi a mesma coisa
  const selectedOption = stitch.type === "satin" ? "contour" : stitch.type;

  /**
   * Monta o patch de um novo StitchParams — e, quando o resultado é
   * Ziguezague numa forma com traço ligado, sincroniza junto a espessura
   * visual do traço (simpleShape.strokeWidth, px) com a largura real do
   * ponto (widthMm) pra o que se vê no canvas bater com o que sai bordado.
   * Sem isso, "Largura" (mm, real) e "Espessura do traço" (px, só visual)
   * seriam 2 controles desencontrados pro mesmo conceito.
   */
  function stitchPatch(nextStitch: StitchParams): Partial<EmbroideryElement> {
    if (nextStitch.type === "zigzag" && simpleShape?.hasStroke) {
      return { stitch: nextStitch, simpleShape: { ...simpleShape, strokeWidth: mmToStrokeWidthPx(nextStitch.widthMm) } };
    }
    return { stitch: nextStitch };
  }

  function setStitch(patch: Partial<StitchParams>) {
    onChange(stitchPatch({ ...stitch, ...patch } as StitchParams));
  }

  /**
   * Preenchimento/Traço são visuais do canvas (ver EmbroideryElement.simpleShape)
   * e não decidem sozinhos como o bordado exporta — quem decide fill-vs-stroke
   * de verdade é o tipo de ponto (STROKE_FAMILY_STITCH_TYPES, ver svgConverter.ts).
   * Sem isso, uma forma "só contorno" na tela podia continuar exportando
   * preenchida (Tatami é o default). Ao ENTRAR nesse estado (preenchimento
   * desligado + traço ligado) com um ponto de preenchimento selecionado,
   * troca automaticamente pro Ziguezague — é o único tipo da família traço
   * com uma largura de verdade (widthMm), então a "Espessura do traço" que
   * o usuário já tinha ajustado vira o valor inicial da largura real (mm),
   * em vez de nascer com o default fixo de 3mm. Não mexe se o ponto atual já
   * for da família traço (zigzag/corrido/ondulado/cetim escolhidos de
   * propósito continuam como estão).
   */
  function handleSimpleShapeToggle(patch: { hasFill?: boolean; hasStroke?: boolean }) {
    if (!simpleShape) return;
    const updated = { ...simpleShape, ...patch };
    const wasOutlineOnly = !simpleShape.hasFill && simpleShape.hasStroke;
    const isOutlineOnly = !updated.hasFill && updated.hasStroke;
    const enteringOutlineOnly = isOutlineOnly && !wasOutlineOnly;

    if (enteringOutlineOnly && !STROKE_FAMILY_STITCH_TYPES.has(stitch.type)) {
      const seededWidthMm = Math.max(1, +(updated.strokeWidth / HOOP_PX_PER_MM).toFixed(2));
      const zigzag = { ...buildStitchForType(stitch, "zigzag"), widthMm: seededWidthMm } as StitchParams;
      onChange({
        simpleShape: { ...updated, strokeWidth: mmToStrokeWidthPx(seededWidthMm) },
        stitch: zigzag,
      });
      return;
    }
    onChange({ simpleShape: updated });
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
                onClick={() => onChange({ ...stitchPatch(buildStitchForType(stitch, opt.value)), stitchSuggested: false })}
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

        {/* Só partes criadas pelas ferramentas Retângulo/Círculo (SimpleShapeTool)
            têm esses 2 controles independentes — a Caneta e formas importadas
            não têm noção de "preenchimento vs. traço" separada da cor. */}
        {simpleShape && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Aparência</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={simpleShape.hasFill}
                onCheckedChange={(checked) => handleSimpleShapeToggle({ hasFill: checked === true })}
              />
              Preenchimento
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={simpleShape.hasStroke}
                onCheckedChange={(checked) => handleSimpleShapeToggle({ hasStroke: checked === true })}
              />
              Traço
            </label>
            {/* Escondido quando o ponto é Ziguezague — "Largura" (mm, abaixo)
                já controla a espessura de verdade nesse caso, e mantém este
                valor sincronizado (ver stitchPatch); mostrar os 2 juntos
                duplicaria o mesmo conceito com unidades diferentes. */}
            {simpleShape.hasStroke && stitch.type !== "zigzag" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Espessura do traço</p>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">1px</span>
                  <Slider
                    min={1}
                    max={20}
                    step={1}
                    value={[simpleShape.strokeWidth]}
                    onValueChange={([v]) => onChange({ simpleShape: { ...simpleShape, strokeWidth: v! } })}
                  />
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">20px</span>
                </div>
                <div className="text-center text-sm font-semibold text-primary">{simpleShape.strokeWidth}px</div>
              </div>
            )}
          </div>
        )}

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

        {/* Ângulo — só tatami lê esse parâmetro no Ink/Stitch (auto_fill);
            contour/meander(base)/circular/running/zigzag/ripple ignoram. */}
        {stitch.type === "tatami" && (
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

        {/* Largura — controla o stroke-width do path, é o que dá a largura do
            ziguezague (real, em mm). Numa forma Retângulo/Círculo "só
            contorno", esse valor também é a espessura mostrada no canvas
            (ver stitchPatch) — a fonte da verdade aqui é o mm, não o px. */}
        {stitch.type === "zigzag" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Largura</p>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-muted-foreground">1mm</span>
              <Slider
                min={1}
                max={8}
                step={0.5}
                value={[stitch.widthMm]}
                onValueChange={([v]) => setStitch({ widthMm: v! })}
              />
              <span className="w-10 shrink-0 text-xs text-muted-foreground">8mm</span>
            </div>
            <div className="text-center text-sm font-semibold text-primary">{stitch.widthMm.toFixed(1)} mm</div>
          </div>
        )}

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
            Avançado
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-3">
            {stitch.type !== "running" && stitch.type !== "zigzag" && stitch.type !== "ripple" && (
              <>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={stitch.underlay ?? false}
                    onCheckedChange={(checked) => setStitch({ underlay: checked === true })}
                  />
                  <span>
                    Underlay (base)
                    <span className="block text-xs text-muted-foreground">
                      Passada de estabilização antes do ponto principal
                    </span>
                  </span>
                </label>

                {(stitch.type === "tatami" || stitch.type === "satinColumn") && (
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

            {(stitch.type === "running" || stitch.type === "zigzag" || stitch.type === "ripple") && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Repetições (ida e volta)
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">1x</span>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[stitch.repeats ?? 1]}
                    onValueChange={([v]) => setStitch({ repeats: v! })}
                  />
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">5x</span>
                </div>
                <div className="text-center text-sm font-semibold text-primary">{stitch.repeats ?? 1}x</div>
              </div>
            )}

            {stitch.type === "zigzag" && (
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

            {(stitch.type === "running" || stitch.type === "ripple") && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ponto bean (reforçado)
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">0</span>
                  <Slider
                    min={0}
                    max={3}
                    step={1}
                    value={[stitch.beanStitchRepeats ?? 0]}
                    onValueChange={([v]) => setStitch({ beanStitchRepeats: v! })}
                  />
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">3</span>
                </div>
                <div className="text-center text-sm font-semibold text-primary">
                  {stitch.beanStitchRepeats ? `${stitch.beanStitchRepeats}x reforçado` : "desligado"}
                </div>
              </div>
            )}

            {stitch.type === "ripple" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Número de linhas
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">3</span>
                  <Slider
                    min={3}
                    max={30}
                    step={1}
                    value={[stitch.lineCount ?? 10]}
                    onValueChange={([v]) => setStitch({ lineCount: v! })}
                  />
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">30</span>
                </div>
                <div className="text-center text-sm font-semibold text-primary">{stitch.lineCount ?? 10}</div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {regionCount !== undefined && regionCount >= 2 && onSplit && (
          <Button
            variant="outline"
            onClick={onSplit}
            title="Divide esta parte nas regiões desconectadas — cada uma vira uma parte própria, com o mesmo ponto/cor, pra você configurar separado"
          >
            <Scissors /> Separar regiões ({regionCount})
          </Button>
        )}

        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 /> Remover área
        </Button>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
