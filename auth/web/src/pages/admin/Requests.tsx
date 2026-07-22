import * as React from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AccessRequest {
  id: string
  email: string
  name: string
  requested_at: string
}

export function RequestsPage() {
  const [requests, setRequests] = React.useState<AccessRequest[] | null>(null)

  const load = React.useCallback(() => {
    api.get<AccessRequest[]>("/admin/api/access-requests").then(setRequests).catch((err) => toast.error(err.message))
  }, [])

  React.useEffect(load, [load])

  async function decide(id: string, action: "approve" | "reject") {
    try {
      await api.post(`/admin/api/access-requests/${id}/${action}`)
      toast.success(action === "approve" ? "Acesso concedido." : "Solicitação recusada.")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro")
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Solicitações pendentes</h1>
        <p className="text-muted-foreground">Quem tentou logar num app sem ter acesso.</p>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nenhuma solicitação pendente.</TableCell></TableRow>
              )}
              {requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{new Date(r.requested_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" onClick={() => decide(r.id, "approve")}>Aprovar</Button>
                    <Button variant="destructive" size="sm" onClick={() => decide(r.id, "reject")}>Recusar</Button>
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
