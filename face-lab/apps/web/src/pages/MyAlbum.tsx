import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { MyPhoto } from "@face-lab/shared";
import { api } from "../api";

export function MyAlbum() {
  const { id } = useParams<{ id: string }>();
  const [photos, setPhotos] = useState<MyPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<MyPhoto[]>(`/api/my/albums/${id}/photos`).then(setPhotos).catch((e) => setError(String(e.message)));
  }
  useEffect(load, [id]);

  async function reject(faceId: string) {
    await api(`/api/my/matches/${faceId}/reject`, { method: "POST" });
    setPhotos((prev) => prev?.filter((p) => p.faceId !== faceId) ?? null);
  }

  return (
    <div className="container">
      <p><Link to="/me">← Meus álbuns</Link></p>
      <h1>Fotos com você</h1>
      {error && <p className="error">{error}</p>}

      <div className="grid photos">
        {photos?.map((p) => (
          <div key={p.id} className="photo-card">
            {p.thumbUrl ? <img src={p.thumbUrl} alt={p.name} loading="lazy" /> : <div className="photo-card" />}
            <div className="meta">
              <span className="name">{p.name}</span>
              <span className="badge">dist {p.distance.toFixed(2)}</span>
            </div>
            <div className="meta">
              {p.webContentLink && <a className="btn small" href={p.webContentLink} target="_blank" rel="noreferrer">Baixar</a>}
              {p.webViewLink && <a className="btn small ghost" href={p.webViewLink} target="_blank" rel="noreferrer">Ver no Drive</a>}
              <button className="ghost small" onClick={() => reject(p.faceId)}>Não sou eu</button>
            </div>
          </div>
        ))}
      </div>
      {photos && photos.length === 0 && <p className="notice">Nenhuma foto aqui.</p>}
    </div>
  );
}
