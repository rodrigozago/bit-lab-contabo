import { useEffect, useState } from "react";
import type { AdminUser, UserRole } from "@face-lab/shared";
import { api } from "../api";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    clusterDistanceThreshold: number;
  };
}

// admin é gerenciado no bit-lab-auth (is_admin) — aqui só guest ↔ producer
const ROLES: UserRole[] = ["guest", "producer"];

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

export function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [working, setWorking] = useState<"rematch" | "recluster" | null>(null);

  function load() {
    api<AdminUser[]>("/api/admin/users").then(setUsers).catch(() => {});
    api<Stats>("/api/admin/stats").then(setStats).catch(() => {});
  }
  useEffect(load, []);

  async function changeRole(id: string, role: UserRole) {
    try {
      await api(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      toast.success("Papel atualizado.");
      load();
    } catch (err) {
      toast.error("Erro ao mudar papel", { description: (err as Error).message });
    }
  }

  async function rematch() {
    setWorking("rematch");
    try {
      const r = await api<{ matches: number; threshold: number }>("/api/admin/rematch", { method: "POST", body: JSON.stringify({}) });
      toast.success(`Rematch concluído: ${r.matches} matches (threshold ${r.threshold}).`);
      load();
    } finally {
      setWorking(null);
    }
  }

  async function recluster() {
    setWorking("recluster");
    try {
      const r = await api<{ albums: number; people: number; threshold: number }>("/api/admin/recluster", {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success(`Recluster concluído: ${r.people} pessoas em ${r.albums} álbum(ns) (threshold ${r.threshold}).`);
      load();
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">Gerencie papéis e monitore o uso.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={stats.users} label="usuários" />
          <StatTile value={stats.albums} label="álbuns" />
          <StatTile value={stats.photos} label="fotos" />
          <StatTile value={stats.faces} label="rostos" />
          <StatTile value={stats.matches} label="matches" />
          <StatTile value={stats.usage_24h} label="reconh. 24h" />
        </div>
      )}

      {stats && (
        <p className="text-xs text-muted-foreground">
          Limites/min: producer {stats.limits.producerPerMin} · global {stats.limits.globalPerMin} · enroll {stats.limits.enrollPerMin} —
          threshold match {stats.limits.matchDistanceThreshold} · cluster {stats.limits.clusterDistanceThreshold} —
          {" "}{stats.enrollments} rosto(s) cadastrados · {stats.usage_total} reconhecimentos no total
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={rematch} disabled={working !== null}>
          {working === "rematch" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Recalcular matches
        </Button>
        <Button variant="outline" onClick={recluster} disabled={working !== null}>
          {working === "recluster" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          Reagrupar pessoas
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Rosto</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <Badge title="gerenciado no bit-lab-auth (is_admin)">admin · via auth</Badge>
                  ) : (
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as UserRole)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {u.hasEnrollment ? <Badge variant="secondary">cadastrado</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
