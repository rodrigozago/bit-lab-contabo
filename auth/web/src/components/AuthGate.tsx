import * as React from "react"

import { useAuth, loginUrl } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Espera GET /api/me: se não tiver sessão, mostra um cartão de "Entrar" que
 * manda pro /login vanilla (bl_session já é compartilhado em *.bit-lab.tech). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <Skeleton className="h-40 w-80 rounded-xl" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="flex h-svh w-full items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>🪡 bit-lab</CardTitle>
            <CardDescription>Entre com sua conta bit-lab pra continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => { window.location.href = loginUrl() }}>
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

/** Some rotas do /admin/* exigem superuser — quem não é vê a dashboard normal. */
export function RequireSuperuser({ children }: { children: React.ReactNode }) {
  const { me } = useAuth()
  if (!me?.isSuperuser) {
    return (
      <div className="px-4 lg:px-6">
        <p className="text-muted-foreground text-sm">Você não tem acesso à administração.</p>
      </div>
    )
  }
  return <>{children}</>
}
