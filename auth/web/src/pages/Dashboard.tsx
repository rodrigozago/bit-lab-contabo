import * as React from "react"
import { ExternalLink } from "lucide-react"

import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface MyAccess {
  app_id: string
  slug: string
  name: string
  role: "end_user" | "app_admin"
}

const roleLabel: Record<MyAccess["role"], string> = {
  end_user: "End user",
  app_admin: "Admin",
}

export function Dashboard() {
  const [apps, setApps] = React.useState<MyAccess[] | null>(null)

  React.useEffect(() => {
    api.get<MyAccess[]>("/api/my-access").then(setApps).catch(() => setApps([]))
  }, [])

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Meus apps</h1>
        <p className="text-muted-foreground">Os apps do bit-lab que você tem acesso.</p>
      </div>

      {apps === null && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {apps?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Você ainda não tem acesso a nenhum app. Peça um link de convite a um superuser.
        </p>
      )}

      {apps && apps.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {apps.map((app) => (
            <a key={app.app_id} href={`https://${app.slug}.bit-lab.tech`} target="_blank" rel="noreferrer">
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{app.name}</CardTitle>
                    <ExternalLink className="text-muted-foreground size-4 shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge variant={app.role === "app_admin" ? "default" : "secondary"}>
                    {roleLabel[app.role]}
                  </Badge>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
