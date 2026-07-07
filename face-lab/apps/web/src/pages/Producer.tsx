import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AlbumSummary } from "@face-lab/shared";
import { api } from "../api";

interface GoogleStatus {
  connected: boolean;
  googleEmail: string | null;
}

function statusBadge(s: AlbumSummary["status"]) {
  const map: Record<AlbumSummary["status"], string> = { pending: "", scanning: "warn", ready: "ok", error: "err" };
  return <span className={`badge ${map[s]}`}>{s}</span>;
}

export function Producer() {
  const [params] = useSearchParams();
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [name, setName] = useState("");
  const [folderUrl, setFolderUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("googleError"));

  function loadAlbums() {
    api<AlbumSummary[]>("/api/albums").then(setAlbums).catch((e) => setError(String(e.message)));
  }
  useEffect(() => {
    api<GoogleStatus>("/api/google/status").then(setGoogle).catch(() => setGoogle({ connected: false, googleEmail: null }));
    loadAlbums();
  }, []);

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const res = await api<{ id: string; folderName: string; linkSharedWarning: string | null }>("/api/albums", {
        method: "POST",
        body: JSON.stringify({ name, driveFolderUrl: folderUrl }),
      });
      setName("");
      setFolderUrl("");
      setMsg(`Álbum criado a partir da pasta "${res.folderName}".${res.linkSharedWarning ? " ⚠️ " + res.linkSharedWarning : ""}`);
      loadAlbums();
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  async function scan(id: string) {
    await api(`/api/albums/${id}/scan`, { method: "POST" });
    loadAlbums();
  }

  return (
    <div className="container">
      <h1>Producer</h1>
      <p className="sub">Crie álbuns a partir de pastas do seu Google Drive. As fotos ficam no seu Drive — indexamos os rostos e guardamos só miniaturas e os links.</p>

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Google Drive</h2>
        {google?.connected ? (
          <p className="notice">
            Conectado como <strong>{google.googleEmail}</strong>{" "}
            <button
              className="ghost small"
              onClick={async () => {
                await api("/api/google", { method: "DELETE" });
                setGoogle({ connected: false, googleEmail: null });
              }}
            >
              Desconectar
            </button>
          </p>
        ) : (
          <>
            <p className="notice">Conecte sua conta Google (somente leitura do Drive) para criar álbuns.</p>
            <a className="btn" href="/api/google/connect">Conectar Google Drive</a>
          </>
        )}
      </div>

      {google?.connected && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Novo álbum</h2>
          <form onSubmit={createAlbum}>
            <label>Nome do álbum / evento</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Casamento Ana & João" required />
            <label>Link da pasta do Google Drive</label>
            <input type="url" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." required />
            <p className="notice" style={{ fontSize: 12 }}>
              Compartilhe a pasta como "qualquer pessoa com o link: leitor" para os convidados conseguirem baixar as fotos.
            </p>
            <button type="submit" style={{ marginTop: 12 }}>Criar álbum</button>
          </form>
        </div>
      )}

      <h2>Álbuns</h2>
      <div className="grid cols-3">
        {albums.map((a) => (
          <div key={a.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{a.name}</strong>
              {statusBadge(a.status)}
            </div>
            <p className="notice" style={{ margin: "8px 0" }}>
              {a.doneCount}/{a.photoCount} fotos · {a.faceCount} rostos
            </p>
            {a.error && <p className="error" style={{ fontSize: 12 }}>{a.error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="btn small ghost" to={`/producer/albums/${a.id}`}>Abrir</Link>
              <button className="small" onClick={() => scan(a.id)} disabled={a.status === "scanning"}>
                {a.status === "scanning" ? "Escaneando…" : a.scannedAt ? "Re-escanear" : "Escanear"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {albums.length === 0 && <p className="notice">Nenhum álbum ainda.</p>}
    </div>
  );
}
