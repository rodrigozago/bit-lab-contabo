import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import type { AlbumSummary, PhotoItem, ScanStatus } from "@face-lab/shared";
import { api } from "../api";

export function ProducerAlbum() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<AlbumSummary | null>(null);
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function loadPhotos() {
    api<PhotoItem[]>(`/api/albums/${id}/photos`).then(setPhotos).catch(() => {});
  }

  useEffect(() => {
    api<AlbumSummary>(`/api/albums/${id}`).then(setAlbum).catch((e) => setError(String(e.message)));
    loadPhotos();

    timer.current = setInterval(async () => {
      try {
        const s = await api<ScanStatus>(`/api/albums/${id}/scan-status`);
        setStatus(s);
        if (s.album !== "scanning") {
          loadPhotos();
          if (s.pending === 0 && timer.current) {
            clearInterval(timer.current);
            timer.current = null;
          }
        }
      } catch {
        // ignora
      }
    }, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [id]);

  async function scan() {
    await api(`/api/albums/${id}/scan`, { method: "POST" });
    if (!timer.current) window.location.reload();
  }

  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div className="container">
      <p><Link to="/producer">← Producer</Link></p>
      <h1>{album?.name ?? "Álbum"}</h1>
      {error && <p className="error">{error}</p>}

      {status && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="notice">
              {status.done}/{status.total} processadas · {status.errors} erros · {status.pending} na fila
            </span>
            <button className="small" onClick={scan} disabled={status.album === "scanning"}>
              {status.album === "scanning" ? "Escaneando…" : "Re-escanear"}
            </button>
          </div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="grid photos">
        {photos.map((p) => (
          <div key={p.id} className="photo-card">
            {p.thumbUrl ? <img src={p.thumbUrl} alt={p.name} loading="lazy" /> : <div style={{ aspectRatio: "4/3", background: "var(--panel-2)" }} />}
            <div className="meta">
              <span className="name">{p.name}</span>
              {p.status === "done" ? (
                <span className="badge ok">{p.faceCount} rosto{p.faceCount === 1 ? "" : "s"}</span>
              ) : p.status === "error" ? (
                <span className="badge err">erro</span>
              ) : (
                <span className="badge warn">{p.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="notice">Nenhuma foto ainda — clique em escanear.</p>}
    </div>
  );
}
