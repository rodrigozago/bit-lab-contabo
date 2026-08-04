"use client";

import { useEffect, useState } from "react";
import type { OnAirSlotView } from "@/lib/types";
import { partitionSlots } from "@/lib/onair-format";
import { Clock } from "@/components/on-air/Clock";
import { NowPlaying } from "@/components/on-air/NowPlaying";
import { Timetable } from "@/components/on-air/Timetable";

/**
 * Toda a lista de slots já veio pronta do server (OnAirSlots.tsx) — sem API
 * própria pra sondar, current/upcoming/past são recalculados aqui a cada
 * tick do relógio (250ms, o mesmo que já existia só pra mostrar os
 * segundos) em vez do poll de 30s + setTimeout na virada de slot do
 * original. Mais simples e sem perda de precisão perceptível: os dados já
 * estão todos no client, então reparticionar é só um filter/sort local.
 *
 * Limitação aceita: editar o line-up no Storyblok com essa aba já aberta só
 * aparece depois de recarregar — não tem refetch em background.
 */
export function OnAirClient({
  slots,
  initialNowIso,
}: {
  slots: OnAirSlotView[];
  /** "now" no momento em que o server buscou os slots — semeia o primeiro
   * render do client com o mesmo instante, evitando um flash de "Ninguém
   * tocando agora" antes da hidratação assumir o próprio relógio. */
  initialNowIso: string;
}) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(timer);
  }, []);

  const { current, upcoming, past } = partitionSlots(slots, now);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1800px] flex-col gap-12 px-4 py-10 sm:py-12 lg:px-12">
      <header className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3 lg:pt-4">
          <span className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-sm font-bold uppercase tracking-[0.4em]">On Air</span>
        </div>
        <Clock now={now} />
      </header>

      <div className="flex flex-1 flex-col gap-16 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex flex-1 justify-center">
          <NowPlaying slot={current} />
        </div>
        <aside className="w-full lg:max-h-[75vh] lg:w-[440px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <Timetable upcoming={upcoming} past={past} />
        </aside>
      </div>

      <footer className="mt-auto text-center text-xs text-muted/60">
        bit-lab · horários em Brasília (GMT-3)
      </footer>
    </main>
  );
}
