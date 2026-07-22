import * as React from "react"
import { toast } from "sonner"
import { Copy } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface App { id: string; slug: string; name: string }
interface TokenRow {
  id: string
  role: "end_user" | "app_admin"
  email: string | null
  expires_at: string
  used_at: string | null
  used_by_email: string | null
  created_by_email: string
  apps: { id: string; slug: string; name: string }[]
}

const roleLabel: Record<TokenRow["role"], string> = { end_user: "End user", app_admin: "Admin (de app)" }

export function TokensPage() {
  const [apps, setApps] = React.useState<App[]>([])
  const [tokens, setTokens] = React.useState<TokenRow[] | null>(null)
  const [role, setRole] = React.useState<TokenRow["role"]>("end_user")
  const [email, setEmail] = React.useState("")
  const [ttlHours, setTtlHours] = React.useState("168")
  const [selectedApps, setSelectedApps] = React.useState<string[]>([])
  const [creating, setCreating] = React.useState(false)
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    Promise.all([
      api.get<App[]>("/admin/api/apps"),
      api.get<TokenRow[]>("/admin/api/signup-tokens"),
    ]).then(([a, t]) => { setApps(a); setTokens(t) })
      .catch((err) => toast.error(err.message))
  }, [])

  React.useEffect(load, [load])

  function toggleApp(id: string, checked: boolean) {
    setSelectedApps((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id))
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault()
    if (selectedApps.length === 0) return toast.error("selecione pelo menos um app")
    setCreating(true)
    try {
      const result = await api.post<{ url: string }>("/admin/api/signup-tokens", {
        role, email: email || undefined, appIds: selectedApps, ttlHours: Number(ttlHours) || undefined,
      })
      setGeneratedUrl(result.url)
      setEmail(""); setSelectedApps([])
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    try {
      await api.delete(`/admin/api/signup-tokens/${id}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  function copyUrl() {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl)
    toast.success("Link copiado.")
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Links de convite</h1>
        <p className="text-muted-foreground">Gera um link de cadastro pra alguém virar End user ou Admin de um ou mais apps.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Gerar link</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createToken} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as TokenRow["role"])}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end_user">End user</SelectItem>
                    <SelectItem value="app_admin">Admin (de app)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="token-email">E-mail (opcional)</Label>
                <Input id="token-email" type="email" placeholder="trava o link a este e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ttl">Validade (horas)</Label>
                <Input id="ttl" type="number" min={1} className="w-32" value={ttlHours} onChange={(e) => setTtlHours(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Apps</Label>
              <div className="flex flex-wrap gap-4">
                {apps.map((app) => (
                  <div key={app.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`app-${app.id}`}
                      checked={selectedApps.includes(app.id)}
                      onCheckedChange={(v) => toggleApp(app.id, !!v)}
                    />
                    <Label htmlFor={`app-${app.id}`} className="font-normal">{app.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Button type="submit" disabled={creating}>Gerar link</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Papel</TableHead>
                <TableHead>Apps</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens?.map((t) => {
                const expired = !t.used_at && new Date(t.expires_at) < new Date()
                return (
                  <TableRow key={t.id} className={t.used_at || expired ? "opacity-60" : ""}>
                    <TableCell><Badge variant={t.role === "app_admin" ? "default" : "secondary"}>{roleLabel[t.role]}</Badge></TableCell>
                    <TableCell>{t.apps.map((a) => a.name).join(", ")}</TableCell>
                    <TableCell>{t.email || <span className="text-muted-foreground">qualquer</span>}</TableCell>
                    <TableCell>{new Date(t.expires_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {t.used_at ? `usado por ${t.used_by_email}` : expired ? "expirado" : "ativo"}
                    </TableCell>
                    <TableCell>
                      {!t.used_at && !expired && (
                        <Button variant="destructive" size="sm" onClick={() => revoke(t.id)}>Revogar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!generatedUrl} onOpenChange={(open) => !open && setGeneratedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de convite gerado</DialogTitle>
            <DialogDescription>
              Copie e envie agora — este link só é mostrado uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={generatedUrl ?? ""} />
            <Button type="button" size="icon" variant="outline" onClick={copyUrl}>
              <Copy />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
