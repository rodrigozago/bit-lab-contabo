import * as React from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface App {
  id: string
  slug: string
  name: string
  allow_self_signup: boolean
}

export function AppsPage() {
  const [apps, setApps] = React.useState<App[] | null>(null)
  const [slug, setSlug] = React.useState("")
  const [name, setName] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(() => {
    api.get<App[]>("/admin/api/apps").then(setApps).catch((err) => toast.error(err.message))
  }, [])

  React.useEffect(load, [load])

  async function createApp(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post("/admin/api/apps", { slug, name })
      toast.success("App criado.")
      setSlug(""); setName("")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    } finally {
      setCreating(false)
    }
  }

  async function toggleSelfSignup(app: App, allowed: boolean) {
    try {
      await api.patch(`/admin/api/apps/${app.id}/self-signup`, { allowed })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  async function removeApp(id: string) {
    if (!window.confirm("Remover este app? Isso também remove os acessos concedidos a ele.")) return
    try {
      await api.delete(`/admin/api/apps/${id}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Apps</h1>
        <p className="text-muted-foreground">Apps protegidos pelo bit-lab-auth e se cada um permite self-signup.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Criar app</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createApp} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" placeholder="ex: face-lab" required value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
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
                <TableHead>Slug</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Self-signup</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps?.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{app.slug}</TableCell>
                  <TableCell>{app.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={app.allow_self_signup}
                        onCheckedChange={(v) => toggleSelfSignup(app, !!v)}
                      />
                      <span className="text-muted-foreground text-xs">
                        {app.allow_self_signup ? "ligado" : "desligado"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" size="sm" onClick={() => removeApp(app.id)}>Remover</Button>
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
