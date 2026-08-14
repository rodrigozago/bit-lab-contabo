import { storyblokEditable } from "@storyblok/react/rsc";
import type { PricingPlansBlok, PricingPlanBlok } from "@/lib/types";

function PlanCard({ plan }: { plan: PricingPlanBlok }) {
  const benefits = plan.benefits?.split("\n").map((b) => b.trim()).filter(Boolean) ?? [];

  return (
    <div
      {...storyblokEditable(plan)}
      className="border-border col-span-12 border p-8 md:col-span-6"
    >
      <p className="text-heading">{plan.name}</p>

      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <span className="text-heading text-accent">{plan.price}</span>
        {plan.price_note && (
          <span className="text-label text-fg-muted">{plan.price_note}</span>
        )}
      </div>

      {benefits.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {benefits.map((benefit) => (
            <li key={benefit} className="text-body flex gap-2">
              <span className="text-accent">›</span>
              {benefit}
            </li>
          ))}
        </ul>
      )}

      {plan.cta_label && plan.cta_url && (
        <a
          href={plan.cta_url}
          target="_blank"
          rel="noreferrer"
          className="bg-accent text-background mt-8 inline-block rounded px-6 py-3 font-bold"
        >
          {plan.cta_label}
        </a>
      )}
    </div>
  );
}

/** Cartões de plano — ex. "Club de Membros" na página de preços. Diferente
 * de DataTable (linhas simples serviço/valor), aqui cada plano tem preço em
 * destaque, lista de benefícios e um CTA de pagamento externo. */
export function PricingPlans({ blok }: { blok: PricingPlansBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} section-pad py-16 md:py-24`}
    >
      {blok.heading && <h2 className="text-heading mb-10">{blok.heading}</h2>}
      <div className="grid-12 gap-y-6">
        {blok.plans?.map((plan) => <PlanCard key={plan._uid} plan={plan} />)}
      </div>
    </section>
  );
}
