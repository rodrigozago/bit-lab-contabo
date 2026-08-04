import { storyblokEditable } from "@storyblok/react/rsc";
import type { FeatureGridBlok } from "@/lib/types";
import { StaggerList } from "@/components/motion/StaggerList";

export function FeatureGrid({ blok }: { blok: FeatureGridBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 py-24 md:py-32`}
    >
      {blok.heading && (
        <h2 className="text-heading col-span-12 mb-12 md:col-span-6">
          {blok.heading}
        </h2>
      )}

      <StaggerList className="grid-12 col-span-12 gap-y-10">
        {blok.features?.map((feature) => (
          <div key={feature._uid} className="col-span-12 md:col-span-4">
            <h3 className="text-label mb-3 text-accent">{feature.title}</h3>
            {feature.description && (
              <p className="text-body text-fg-muted">{feature.description}</p>
            )}
          </div>
        ))}
      </StaggerList>
    </section>
  );
}
