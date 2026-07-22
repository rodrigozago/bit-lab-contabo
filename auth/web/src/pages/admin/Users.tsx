import * as React from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface User {
  id: string
  email: string
  is_superuser: boolean
  created_at: string
}

export function UsersPage() {
  const [users, setUsers] = React.useState<User[] | null>(null)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isSuperuser, setIsSuperuser] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(() => {
    api.get<User[]>("/admin/api/users").then(setUsers).catch((err) => toast.error(err.message))
  }, [])

  React.useEffect(load, [load])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post("/admin/api/users", { email, password, isSuperuser })
      toast.success("Usuário criado.")
      setEmail(""); setPassword(""); setIsSuperuser(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    } finally {
      setCreating(false)
    }
  }

  async function resetPassword(id: string) {
    const password = window.prompt("Nova senha:")
    if (!password) return
    try {
      await api.post(`/admin/api/users/${id}/reset-password`, { password })
      toast.success("Senha atualizada.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  async function removeUser(id: string) {
    if (!window.confirm("Remover este usuário?")) return
    try {
      await api.delete(`/admin/api/users/${id}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">Contas com login no bit-lab.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Criar usuário</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="text" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox id="superuser" checked={isSuperuser} onCheckedChange={(v) => setIsSuperuser(!!v)} />
              <Label htmlFor="superuser">Superuser</Label>
            </div>
            <Button type="submit" disabled={creating}>Criar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.is_superuser ? <Badge>Superuser</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => resetPassword(u.id)}>Resetar senha</Button>
                    <Button variant="destructive" size="sm" onClick={() => removeUser(u.id)}>Remover</Button>
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
