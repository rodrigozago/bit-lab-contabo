import * as React from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface User { id: string; email: string }
interface App { id: string; slug: string; name: string }
interface Access { user_id: string; email: string; app_id: string; slug: string; name: string; role: "end_user" | "app_admin" }

const roleLabel: Record<Access["role"], string> = { end_user: "End user", app_admin: "Admin" }

export function AccessPage() {
  const [users, setUsers] = React.useState<User[]>([])
  const [apps, setApps] = React.useState<App[]>([])
  const [access, setAccess] = React.useState<Access[] | null>(null)
  const [userId, setUserId] = React.useState("")
  const [appId, setAppId] = React.useState("")
  const [role, setRole] = React.useState<Access["role"]>("end_user")

  const load = React.useCallback(() => {
    Promise.all([
      api.get<User[]>("/admin/api/users"),
      api.get<App[]>("/admin/api/apps"),
      api.get<Access[]>("/admin/api/access"),
    ]).then(([u, a, acc]) => { setUsers(u); setApps(a); setAccess(acc) })
      .catch((err) => toast.error(err.message))
  }, [])

  React.useEffect(load, [load])

  async function grant(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !appId) return toast.error("selecione usuário e app")
    try {
      await api.post("/admin/api/access", { userId, appId, role })
      toast.success("Acesso concedido.")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  async function changeRole(a: Access, newRole: Access["role"]) {
    try {
      await api.patch(`/admin/api/access/${a.user_id}/${a.app_id}/role`, { role: newRole })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  async function revoke(a: Access) {
    try {
      await api.delete(`/admin/api/access/${a.user_id}/${a.app_id}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Acessos</h1>
        <p className="text-muted-foreground">Quem tem acesso a qual app, e com qual papel.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Conceder acesso</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={grant} className="flex flex-wrap items-end gap-4">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Usuário" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={appId} onValueChange={setAppId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="App" /></SelectTrigger>
              <SelectContent>
                {apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => setRole(v as Access["role"])}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="end_user">End user</SelectItem>
                <SelectItem value="app_admin">Admin (de app)</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Conceder</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {access?.map((a) => (
                <TableRow key={`${a.user_id}-${a.app_id}`}>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>
                    <Select value={a.role} onValueChange={(v) => changeRole(a, v as Access["role"])}>
                      <SelectTrigger className="w-40" size="sm"><SelectValue>{roleLabel[a.role]}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end_user">End user</SelectItem>
                        <SelectItem value="app_admin">Admin (de app)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" size="sm" onClick={() => revoke(a)}>Revogar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
