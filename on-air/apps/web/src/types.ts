export interface Slot {
  id: number
  artist: string
  genre: string
  image_url: string | null
  /** ISO UTC — usado pra timers/comparações */
  starts_at: string
  ends_at: string
  /** 'YYYY-MM-DDTHH:mm' na parede de São Paulo — pré-preenche o datetime-local */
  starts_at_local: string
  ends_at_local: string
}

export interface TimetableResponse {
  /** "agora" do servidor (ISO UTC) — a autoridade sobre quem está tocando */
  now: string
  current: Slot | null
  upcoming: Slot[]
  past: Slot[]
}
