import { useEffect, useState } from "react";
import type { AlbumSummary, PhotoItem, ProducerPageSettings } from "@face-lab/shared";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { api } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderMarkdown } from "@/lib/markdown";

/** Configuração da página pública do fotógrafo (/p/:slug). */
export function ProducerPage() {
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [heroPhotoId, setHeroPhotoId] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [editorial, setEditorial] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ProducerPageSettings | null>(null);

  // hero picker: escolhe um álbum e clica numa foto processada
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [pickerAlbum, setPickerAlbum] = useState<string | null>(null);
  const [pickerPhotos, setPickerPhotos] = useState<PhotoItem[]>([]);

  useEffect(() => {
    api<ProducerPageSettings | null>("/api/producer/page")
      .then((s) => {
        if (!s) return;
        setSaved(s);
        setSlug(s.slug);
        setDisplayName(s.displayName);
        setHeroPhotoId(s.heroPhotoId);
        setHeroUrl(s.heroUrl);
        setEditorial(s.editorialMd ?? "");
      })
      .catch((e) => toast.error("Erro ao carregar página", { description: (e as Error).message }));
    api<AlbumSummary[]>("/api/albums").then(setAlbums).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pickerAlbum) return setPickerPhotos([]);
    api<PhotoItem[]>(`/api/albums/${pickerAlbum}/photos`)
      .then((ps) => setPickerPhotos(ps.filter((p) => p.status === "done" && p.thumbUrl)))
      .catch(() => setPickerPhotos([]));
  }, [pickerAlbum]);

  async function save() {
    setSaving(true);
    try {
      const s = await api<ProducerPageSettings>("/api/producer/page", {
        method: "PUT",
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          displayName: displayName.trim(),
          heroPhotoId,
          editorialMd: editorial.trim() || null,
        }),
      });
      setSaved(s);
      toast.success("Página pública salva.");
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="heading-editorial">Página pública</h1>
        <p className="mt-1 text-muted-foreground">
          Seu portfólio em face-lab: só aparecem os álbuns e fotos que você destacar.
        </p>
        {saved && (
          <a
            href={`/p/${saved.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent-secondary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver página pública — /p/{saved.slug}
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>Nome exibido no letreiro do hero e endereço da página.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="display-name">Nome do artista</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="João Fotografia"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug (URL)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/p/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="joaophoto"
              />
            </div>
            <p className="text-xs text-muted-foreground">a-z, 0-9 e hífens, 2-40 caracteres.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imagem do hero</CardTitle>
          <CardDescription>Aparece atrás do letreiro com seu nome. Escolha uma foto de um álbum.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {heroUrl && (
            <div className="relative h-40 overflow-hidden bg-secondary">
              <img src={heroUrl} alt="Hero atual" className="h-full w-full object-cover" />
            </div>
          )}
          <Select value={pickerAlbum ?? undefined} onValueChange={setPickerAlbum}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Escolher álbum…" />
            </SelectTrigger>
            <SelectContent>
              {albums.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pickerPhotos.length > 0 && (
            <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {pickerPhotos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setHeroPhotoId(p.id);
                    setHeroUrl(p.thumbUrl);
                  }}
                  className={`aspect-square overflow-hidden bg-secondary ${
                    heroPhotoId === p.id ? "ring-2 ring-accent" : "hover:opacity-80"
                  }`}
                >
                  <img src={p.thumbUrl!} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editorial</CardTitle>
          <CardDescription>
            Texto opcional entre o hero e as imagens. Markdown simples: **negrito**, *itálico*, ## título.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={editorial}
            onChange={(e) => setEditorial(e.target.value)}
            rows={6}
            placeholder="Fotografia é sobre presença…"
            className="w-full border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {editorial.trim() && (
            <div className="space-y-4 border-l-2 border-accent pl-4 font-serif text-foreground/90">
              {renderMarkdown(editorial)}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving || !slug.trim() || !displayName.trim()}>
        {saving ? "Salvando…" : "Salvar página"}
      </Button>
    </div>
  );
}
