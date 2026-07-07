import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MyAlbum as MyAlbumType } from "@face-lab/shared";
import { api } from "../api";
import { useAuth } from "../App";

export function MyGallery() {
  const { me } = useAuth();
  const [albums, setAlbums] = useState<MyAlbumType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MyAlbumType[]>("/api/my/albums").then(setAlbums).catch((e) => setError(String(e.message)));
  }, []);

  return (
    <div className="container">
      <h1>Minhas fotos</h1>
      <p className="sub">Álbuns onde te reconhecemos.</p>

      {me && !me.hasEnrollment && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="notice">
            Você ainda não cadastrou seu rosto — sem isso não conseguimos te encontrar nas fotos.
          </p>
          <Link className="btn" to="/enroll">Cadastrar meu rosto</Link>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {albums && albums.length === 0 && (
        <p className="notice">
          Ainda não encontramos você em nenhum álbum. Assim que um producer publicar fotos de um
          evento em que você esteve, elas aparecem aqui.
        </p>
      )}

      <div className="grid cols-3">
        {albums?.map((a) => (
          <Link key={a.id} to={`/me/albums/${a.id}`} className="card">
            <strong>{a.name}</strong>
            <p className="notice" style={{ margin: "8px 0 0" }}>
              {a.matchCount} foto{a.matchCount === 1 ? "" : "s"} com você
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
