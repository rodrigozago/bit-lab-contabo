import { storyblokEditable } from "@storyblok/react/rsc";
import type { CourseSignupFormBlok } from "@/lib/types";
import { getStudioSession } from "@/lib/studio-session";
import { StudioLoginGate } from "@/components/studio/StudioLoginGate";
import { StudioIncompleteProfile } from "@/components/studio/StudioIncompleteProfile";
import { CourseSignupFormClient } from "./CourseSignupFormClient";

/** Form de inscrição em curso — server component (não client): decide entre
 * login gate, perfil incompleto ou o form de verdade conforme
 * getStudioSession(), mesmo dado usado pra pré-preencher nome/instagram/
 * whatsapp (como o /opencdj faz), mas aqui só essa seção fica atrás de
 * login — o resto da página (programa, preço) é público. */
export async function CourseSignupForm({ blok }: { blok: CourseSignupFormBlok }) {
  const theme = blok.theme ?? "dark";
  const returnTo = blok.return_to || "/curso-discotecagem";
  const session = await getStudioSession();

  return (
    <section
      id="inscricao"
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 py-24 md:py-32`}
    >
      <div className="col-span-12 md:col-span-6">
        <h2 className="text-heading mb-4">{blok.heading}</h2>
        {blok.intro && <p className="text-body text-fg-muted max-w-md">{blok.intro}</p>}
      </div>

      <div className="col-span-12 md:col-span-6">
        {!session ? (
          <StudioLoginGate returnTo={returnTo} />
        ) : !session.name || !session.instagram || !session.whatsapp ? (
          <StudioIncompleteProfile returnTo={returnTo} />
        ) : (
          <CourseSignupFormClient
            name={session.name}
            instagram={session.instagram}
            whatsapp={session.whatsapp}
            experienceLabel={blok.experience_label}
            experienceOptions={blok.experience_options}
            motivationLabel={blok.motivation_label}
            motivationPlaceholder={blok.motivation_placeholder}
            submitText={blok.submit_text}
            successMessage={blok.success_message}
          />
        )}
      </div>
    </section>
  );
}
