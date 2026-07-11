import { useState, type FormEvent } from 'react'
import { adminApi, AdminApiError } from '../api'
import type { Slot } from '../types'

interface Props {
  /** slot em edição, ou null pra criar um novo */
  slot: Slot | null
  onSaved: () => void
  onCancel: () => void
}

export default function SlotForm({ slot, onSaved, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const form = new FormData(e.currentTarget)
    try {
      if (slot) await adminApi.update(slot.id, form)
      else await adminApi.create(form)
      onSaved()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Erro inesperado ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-edge bg-background px-3 py-2 text-sm focus:border-accent-bright focus:outline-none'
  const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-edge bg-surface p-5"
    >
      <h2 className="font-bold">{slot ? `Editando: ${slot.artist}` : 'Novo slot'}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="artist">Artista</label>
          <input id="artist" name="artist" required defaultValue={slot?.artist} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="genre">Gênero</label>
          <input id="genre" name="genre" required defaultValue={slot?.genre} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="starts_at_local">Início (horário de Brasília)</label>
          <input
            id="starts_at_local"
            name="starts_at_local"
            type="datetime-local"
            required
            defaultValue={slot?.starts_at_local}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="ends_at_local">Fim (horário de Brasília)</label>
          <input
            id="ends_at_local"
            name="ends_at_local"
            type="datetime-local"
            required
            defaultValue={slot?.ends_at_local}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="photo">
            Foto {slot?.image_url ? '(deixe vazio pra manter a atual)' : '(opcional)'}
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1 file:text-xs file:font-bold file:text-foreground`}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold hover:bg-accent-bright disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-edge px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
