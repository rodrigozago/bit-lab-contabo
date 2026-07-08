import { useEffect, useState } from "react";
import type { AdminUser, UserRole } from "@face-lab/shared";
import { api } from "../api";

interface Stats {
  users: number;
  albums: number;
  photos: number;
  faces: number;
  matches: number;
  enrollments: number;
  usage_24h: number;
  usage_total: number;
  limits: {
    producerPerMin: number;
    globalPerMin: number;
    enrollPerMin: number;
    matchDistanceThreshold: number;
  };
}

// admin é gerenciado no bit-lab-auth (is_admin) — aqui só guest ↔ producer
const ROLES: UserRole[] = ["guest", "producer"];

export function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api<AdminUser[]>("/api/admin/users").then(setUsers).catch(() => {});
    api<Stats>("/api/admin/stats").then(setStats).catch(() => {});
  }
  useEffect(load, []);

  async function changeRole(id: string, role: UserRole) {
    await api(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    load();
  }

  async function rematch() {
    setMsg("Recalculando…");
    const r = await api<{ matches: number; threshold: number }>("/api/admin/rematch", { method: "POST" });
    setMsg(`Rematch concluído: ${r.matches} matches (threshold ${r.threshold}).`);
    load();
  }

  return (
    <div className="container">
      <h1>Admin</h1>
      <p className="sub">Gerencie papéis e monitore o uso.</p>

      {stats && (
        <div className="grid cols-3" style={{ marginBottom: 24 }}>
          <div className="card"><strong>{stats.users}</strong><p className="notice">usuários</p></div>
          <div className="card"><strong>{stats.albums}</strong><p className="notice">álbuns</p></div>
          <div className="card"><strong>{stats.photos}</strong><p className="notice">fotos · {stats.faces} rostos</p></div>
          <div className="card"><strong>{stats.matches}</strong><p className="notice">matches · {stats.enrollments} rostos cadastrados</p></div>
          <div className="card"><strong>{stats.usage_24h}</strong><p className="notice">reconhecimentos (24h) · {stats.usage_total} total</p></div>
          <div className="card">
            <p className="notice" style={{ margin: 0, fontSize: 12 }}>
              Limites/min: producer {stats.limits.producerPerMin} · global {stats.limits.globalPerMin} · enroll {stats.limits.enrollPerMin}<br />
              Threshold: {stats.limits.matchDistanceThreshold}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button onClick={rematch}>Recalcular matches (rematch)</button>
        {msg && <span className="notice">{msg}</span>}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>E-mail</th><th>Papel</th><th>Rosto</th><th>Criado</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  {u.role === "admin" ? (
                    <span className="badge ok" title="gerenciado no bit-lab-auth (is_admin)">admin · via auth</span>
                  ) : (
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as UserRole)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </td>
                <td>{u.hasEnrollment ? <span className="badge ok">sim</span> : <span className="badge">não</span>}</td>
                <td className="notice">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
