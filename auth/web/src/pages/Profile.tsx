import * as React from "react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function Profile() {
  const { me, refresh } = useAuth()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [name, setName] = React.useState(me?.name ?? "")
  const [email, setEmail] = React.useState(me?.email ?? "")
  const [instagram, setInstagram] = React.useState(me?.instagram ?? "")
  const [whatsapp, setWhatsapp] = React.useState(me?.whatsapp ?? "")
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)

  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [savingPassword, setSavingPassword] = React.useState(false)

  React.useEffect(() => {
    setName(me?.name ?? "")
    setEmail(me?.email ?? "")
    setInstagram(me?.instagram ?? "")
    setWhatsapp(me?.whatsapp ?? "")
  }, [me?.name, me?.email, me?.instagram, me?.whatsapp])

  if (!me) return null

  const displayName = me.name || me.email.split("@")[0]

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await api.patch("/api/me", { name, email, instagram, whatsapp })
      await refresh()
      toast.success("Perfil atualizado.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro ao salvar perfil")
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("as senhas novas não conferem")
      return
    }
    setSavingPassword(true)
    try {
      await api.patch("/api/me/password", { currentPassword, newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Senha alterada.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro ao trocar senha")
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const res = await fetch("/api/me/avatar", { method: "POST", body: formData })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `erro (${res.status})`)
      await refresh()
      toast.success("Foto atualizada.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "erro ao enviar foto")
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-muted-foreground">Edite seus dados de conta.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>PNG, JPEG ou WEBP, até 5MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-medium">
            {me.avatarUrl ? (
              <img src={me.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              displayName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingAvatar ? "Enviando..." : "Trocar foto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Dados da conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSaveProfile}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="seu nome" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@seuusuario"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <Button type="submit" disabled={savingProfile} className="self-start">
              {savingProfile ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleChangePassword}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={savingPassword} className="self-start">
              {savingPassword ? "Salvando..." : "Trocar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
