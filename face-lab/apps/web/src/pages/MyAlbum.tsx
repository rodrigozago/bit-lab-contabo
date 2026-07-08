import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { MyPhoto } from "@face-lab/shared";
import { api } from "../api";

// quadrado sobre o rosto que o sistema diz ser o usuário (coords em % da foto)
function FaceBox({ photo }: { photo: MyPhoto }) {
  const { faceBbox: b, photoWidth: w, photoHeight: h } = photo;
  if (!b || !w || !h) return null;
  const confirmed = photo.matchStatus === "confirmed";
  return (
    <div
      className={`face-box ${confirmed ? "confirmed" : ""}`}
      style={{
        left: `${(b.x / w) * 100}%`,
        top: `${(b.y / h) * 100}%`,
        width: `${(b.w / w) * 100}%`,
        height: `${(b.h / h) * 100}%`,
      }}
      title={confirmed ? "você (confirmado)" : "é você?"}
    />
  );
}

export function MyAlbum() {
  const { id } = useParams<{ id: string }>();
  const [photos, setPhotos] = useState<MyPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // faceId em ação
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    api<MyPhoto[]>(`/api/my/albums/${id}/photos`).then(setPhotos).catch((e) => setError(String(e.message)));
  }
  useEffect(load, [id]);

  async function confirm(faceId: string) {
    setBusy(faceId);
    try {
      const r = await api<{ newMatches: number }>(`/api/my/matches/${faceId}/confirm`, { method: "POST", body: JSON.stringify({}) });
      setNotice(r.newMatches > 0 ? `Confirmado! Encontramos mais ${r.newMatches} foto(s) com você.` : "Confirmado!");
      load(); // a expansão pode ter adicionado fotos neste álbum
    } finally {
      setBusy(null);
    }
  }

  async function reject(faceId: string) {
    setBusy(faceId);
    try {
      await api(`/api/my/matches/${faceId}/reject`, { method: "POST", body: JSON.stringify({}) });
      setNotice("Ok — removemos todas as fotos dessa pessoa da sua galeria.");
      load(); // rejeição é por pessoa: outras fotos podem ter saído também
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="container">
      <p><Link to="/me">← Meus álbuns</Link></p>
      <h1>Fotos com você</h1>
      <p className="sub">O quadrado marca qual rosto achamos que é você — confirme ou corrija.</p>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <div className="grid photos">
        {photos?.map((p) => (
          <div key={p.id} className="photo-card">
            <div
              className="photo-frame"
              style={p.photoWidth && p.photoHeight ? { aspectRatio: `${p.photoWidth} / ${p.photoHeight}` } : undefined}
            >
              {p.thumbUrl && <img src={p.thumbUrl} alt={p.name} loading="lazy" />}
              <FaceBox photo={p} />
            </div>
            <div className="meta">
              <span className="name">{p.name}</span>
              {p.matchStatus === "confirmed" ? (
                <span className="badge ok">✓ você</span>
              ) : (
                <span className="badge">dist {p.distance.toFixed(2)}</span>
              )}
            </div>
            <div className="meta">
              {p.webContentLink && <a className="btn small" href={p.webContentLink} target="_blank" rel="noreferrer">Baixar</a>}
              {p.webViewLink && <a className="btn small ghost" href={p.webViewLink} target="_blank" rel="noreferrer">Ver no Drive</a>}
            </div>
            <div className="meta">
              {p.matchStatus !== "confirmed" && (
                <button className="small" disabled={busy === p.faceId} onClick={() => confirm(p.faceId)}>
                  Sou eu
                </button>
              )}
              <button className="ghost small" disabled={busy === p.faceId} onClick={() => reject(p.faceId)}>
                Não sou eu
              </button>
            </div>
          </div>
        ))}
      </div>
      {photos && photos.length === 0 && <p className="notice">Nenhuma foto aqui.</p>}
    </div>
  );
}
