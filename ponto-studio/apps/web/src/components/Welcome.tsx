import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Hoop } from "@ponto-studio/shared";
import { api } from "../api/client.ts";
import { cn } from "@/lib/utils.ts";
import { Logo } from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";

interface Props {
  onStart: (projectId: string) => void;
  onCancel?: () => void;
}

export function Welcome({ onStart, onCancel }: Props) {
  const [name, setName] = useState("Meu Bordado");
  const [customHoops, setCustomHoops] = useState<Hoop[]>([]);
  const [defaultHoops, setDefaultHoops] = useState<Hoop[]>([]);
  const [selectedHoopId, setSelectedHoopId] = useState<string | null>(null);
  const [hoopsLoading, setHoopsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // form de bastidor customizado
  const [showHoopForm, setShowHoopForm] = useState(false);
  const [hoopName, setHoopName] = useState("");
  const [hoopW, setHoopW] = useState("100");
  const [hoopH, setHoopH] = useState("100");
  const [hoopSaving, setHoopSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { custom, defaults } = await api.hoops.list();
        setCustomHoops(custom);
        setDefaultHoops(defaults);
        // pré-seleciona: primeiro customizado, senão o primeiro padrão
        setSelectedHoopId(custom[0]?.id ?? defaults[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar bastidores");
      } finally {
        setHoopsLoading(false);
      }
    })();
  }, []);

  const allHoops = [...customHoops, ...defaultHoops];
  const selectedHoop = allHoops.find((h) => h.id === selectedHoopId) ?? null;

  async function handleCreate() {
    if (!selectedHoop || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const project = await api.projects.create({
        name: name.trim(),
        canvas: { widthMm: selectedHoop.widthMm, heightMm: selectedHoop.heightMm },
      });
      onStart(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar projeto");
      setLoading(false);
    }
  }

  async function handleCreateHoop() {
    const widthMm = Number(hoopW);
    const heightMm = Number(hoopH);
    if (!hoopName.trim() || !isFinite(widthMm) || !isFinite(heightMm)) return;
    setHoopSaving(true);
    setError("");
    try {
      const hoop = await api.hoops.create({ name: hoopName.trim(), widthMm, heightMm });
      setCustomHoops((prev) => [hoop, ...prev]);
      setSelectedHoopId(hoop.id);
      setShowHoopForm(false);
      setHoopName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar bastidor");
    } finally {
      setHoopSaving(false);
    }
  }

  async function handleDeleteHoop(id: string) {
    try {
      await api.hoops.delete(id);
      setCustomHoops((prev) => prev.filter((h) => h.id !== id));
      if (selectedHoopId === id) {
        setSelectedHoopId(defaultHoops[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar bastidor");
    }
  }

  function hoopOption(hoop: Hoop, isCustom: boolean) {
    return (
      <div key={hoop.id} className="flex items-stretch gap-1.5">
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
            hoop.id === selectedHoopId
              ? "border-primary bg-accent font-semibold text-primary"
              : "border-input bg-background hover:bg-accent/50"
          )}
          onClick={() => setSelectedHoopId(hoop.id)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {isCustom && (
              <Badge className="shrink-0 bg-primary px-1.5 py-0 text-[9px] uppercase">meu</Badge>
            )}
            <span className="truncate">{hoop.name}</span>
          </span>
          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
            {Math.round(hoop.widthMm)} × {Math.round(hoop.heightMm)} mm
          </span>
        </button>
        {isCustom && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto w-9 shrink-0"
            title="Deletar bastidor"
            onClick={() => void handleDeleteHoop(hoop.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col gap-5 p-6 md:p-8">
          {onCancel && (
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0 text-sm"
              onClick={onCancel}
            >
              ← Voltar
            </Button>
          )}

          <div className="flex flex-col items-center gap-1 text-center">
            <Logo size={36} variant="transparent" />
            <h1 className="text-xl font-bold">Novo projeto</h1>
            <p className="text-sm font-semibold text-primary">Digitalize seus bordados</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name" className="uppercase tracking-wide text-muted-foreground">
              Nome do projeto
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Floral Primavera"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="uppercase tracking-wide text-muted-foreground">Bastidor</Label>
            {hoopsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando bastidores…</p>
            ) : (
              <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1">
                {customHoops.map((h) => hoopOption(h, true))}
                {defaultHoops.map((h) => hoopOption(h, false))}
              </div>
            )}

            {!showHoopForm ? (
              <Button
                type="button"
                variant="outline"
                className="mt-1 self-start border-dashed text-primary"
                onClick={() => setShowHoopForm(true)}
              >
                ＋ Bastidor customizado
              </Button>
            ) : (
              <Card className="mt-1 bg-muted/40">
                <CardContent className="flex flex-col gap-2 p-3">
                  <Input
                    value={hoopName}
                    onChange={(e) => setHoopName(e.target.value)}
                    placeholder="Nome (ex: Meu bastidor 15cm)"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="flex-1"
                      min={10}
                      max={600}
                      value={hoopW}
                      onChange={(e) => setHoopW(e.target.value)}
                      placeholder="Largura mm"
                    />
                    <span className="text-sm text-muted-foreground">×</span>
                    <Input
                      type="number"
                      className="flex-1"
                      min={10}
                      max={600}
                      value={hoopH}
                      onChange={(e) => setHoopH(e.target.value)}
                      placeholder="Altura mm"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">mm</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowHoopForm(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleCreateHoop()}
                      disabled={hoopSaving || !hoopName.trim()}
                    >
                      {hoopSaving ? "Salvando…" : "Salvar bastidor"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Button
            size="lg"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || !selectedHoop || loading}
          >
            {loading ? "Criando…" : "Criar projeto →"}
          </Button>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
