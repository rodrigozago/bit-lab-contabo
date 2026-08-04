"use client";

import { useEffect, useState } from "react";

/**
 * Relógio ao vivo no header — mesmo detalhe do 2xa.studio (ATH/AMS).
 * Aqui só um timezone (horário de Brasília, onde a bit-lab opera), sem
 * custo de layout e sem depender de geolocalização do visitante.
 */
export function LocalClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(formatter.format(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Renderiza vazio no primeiro paint (SSR) pra não divergir do client.
  return (
    <span className="text-label tabular-nums" suppressHydrationWarning>
      BR {time ?? "--:--"}
    </span>
  );
}
