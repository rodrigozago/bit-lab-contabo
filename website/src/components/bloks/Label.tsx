import Image from "next/image";
import { storyblokEditable, StoryblokServerRichText } from "@storyblok/react/rsc";
import type { StoryblokRichTextNode } from "@storyblok/react/rsc";
import type { LabelStoryContent } from "@/lib/types";
import { RevealText } from "@/components/motion/RevealText";
import { StaggerList } from "@/components/motion/StaggerList";

/** Componente RAIZ (não nestable) — página de detalhe de um label, ex.
 * studio.bit-lab.tech/labels/pista-oculta. Registrado em bloks/index.tsx
 * como "label". Diferente de "project", que hoje não tem componente raiz
 * registrado (a página de detalhe de projeto no site principal não
 * renderiza) — aqui o registro existe de propósito, pra não repetir isso. */
export function Label({ blok }: { blok: LabelStoryContent }) {
  return (
    <main {...storyblokEditable(blok)} className="theme--dark grid-12 py-24 md:py-32">
      <p className="text-label col-span-12 mb-6 text-accent">LABEL</p>

      <RevealText as="h1" className="text-display col-span-12 mb-8 md:col-span-8">
        {blok.name}
      </RevealText>

      {blok.tagline && (
        <p className="text-heading col-span-12 mb-10 text-fg-muted md:col-span-8">
          {blok.tagline}
        </p>
      )}

      {blok.photo?.filename && (
        <div className="relative col-span-12 mb-10 aspect-[4/3] overflow-hidden md:col-span-4 md:mb-0">
          <Image
            src={blok.photo.filename}
            alt={blok.photo.alt || blok.name}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div className="text-body col-span-12 max-w-2xl md:col-span-8">
        <StoryblokServerRichText
          doc={blok.bio as StoryblokRichTextNode<React.ReactElement>}
        />
      </div>

      {(blok.genres || blok.instagram) && (
        <div className="col-span-12 mt-16 flex flex-col gap-4 md:col-span-8">
          {blok.genres && (
            <p className="text-label text-fg-muted">{blok.genres}</p>
          )}
          {blok.instagram && (
            <a
              href={
                blok.instagram.startsWith("http")
                  ? blok.instagram
                  : `https://instagram.com/${blok.instagram.replace(/^@/, "")}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-label inline-block w-fit border-b border-accent pb-1"
            >
              INSTAGRAM
            </a>
          )}
        </div>
      )}

      {blok.participants && blok.participants.length > 0 && (
        <div className="col-span-12 mt-20">
          <p className="text-label mb-8 text-accent">PARTICIPANTES</p>

          <StaggerList className="grid-12 gap-y-10">
            {blok.participants.map((participant) => (
              <div key={participant._uid} className="col-span-12 md:col-span-4">
                {participant.photo?.filename && (
                  <div className="relative mb-4 aspect-square overflow-hidden">
                    <Image
                      src={participant.photo.filename}
                      alt={participant.photo.alt || participant.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                <p className="text-label">{participant.name}</p>

                {participant.function_label && (
                  <p className="text-label text-fg-muted">{participant.function_label}</p>
                )}

                {participant.mini_bio && (
                  <p className="text-body text-fg-muted mt-2">{participant.mini_bio}</p>
                )}

                {participant.instagram && (
                  <a
                    href={
                      participant.instagram.startsWith("http")
                        ? participant.instagram
                        : `https://instagram.com/${participant.instagram.replace(/^@/, "")}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-label mt-2 inline-block w-fit border-b border-accent pb-1"
                  >
                    INSTAGRAM
                  </a>
                )}
              </div>
            ))}
          </StaggerList>
        </div>
      )}
    </main>
  );
}
