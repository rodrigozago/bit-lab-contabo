import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { adminApi, AdminApiError } from '../api'
import type { Slot } from '../types'
import SlotForm from '../components/SlotForm'
import { fmtDay, fmtRange } from '../lib/time'

export default function Admin() {
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null = sem form; 'new' = criando; Slot = editando
  const [editing, setEditing] = useState<Slot | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setSlots(await adminApi.list())
      setError(null)
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Erro ao carregar slots')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(slot: Slot) {
    if (!window.confirm(`Remover o slot de ${slot.artist}?`)) return
    try {
      await adminApi.remove(slot.id)
      void load()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Erro ao remover')
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Admin — On Air</h1>
          <p className="text-sm text-muted">
            Timetable dos DJs · horários em Brasília ·{' '}
            <a href="/" className="text-accent-bright hover:underline">
              ver página pública
            </a>
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold hover:bg-accent-bright"
          >
            <Plus size={16} /> Novo slot
          </button>
        )}
      </header>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {editing && (
        <SlotForm
          slot={editing === 'new' ? null : editing}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {slots === null ? (
        <p className="text-muted">Carregando…</p>
      ) : slots.length === 0 ? (
        <p className="text-muted">Nenhum slot cadastrado ainda — crie o primeiro.</p>
      ) : (
        <ul className="space-y-2">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center gap-4 rounded-xl border border-edge bg-surface px-4 py-3"
            >
              {slot.image_url ? (
                <img
                  src={slot.image_url}
                  alt={slot.artist}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-black">
                  {slot.artist.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{slot.artist}</p>
                <p className="truncate text-sm text-muted">{slot.genre}</p>
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums text-muted">
                <p className="capitalize">{fmtDay(slot.starts_at)}</p>
                <p>{fmtRange(slot.starts_at, slot.ends_at)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(slot)}
                  title="Editar"
                  className="rounded-lg p-2 text-muted hover:bg-background hover:text-foreground"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => void handleDelete(slot)}
                  title="Remover"
                  className="rounded-lg p-2 text-muted hover:bg-background hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
