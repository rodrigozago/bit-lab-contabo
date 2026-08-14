import { storyblokEditable } from "@storyblok/react/rsc";
import type { CourseCurriculumBlok } from "@/lib/types";
import { StaggerList } from "@/components/motion/StaggerList";

/** Programa/currículo de um curso — lista de módulos editável no Storyblok
 * (campo Blocks restrito a course_module). Mesmo padrão visual de
 * FeatureGrid, com numeração e duração por módulo. */
export function CourseCurriculum({ blok }: { blok: CourseCurriculumBlok }) {
  const theme = blok.theme ?? "dark";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 py-24 md:py-32`}
    >
      {blok.heading && (
        <h2 className="text-heading col-span-12 mb-12 md:col-span-6">{blok.heading}</h2>
      )}

      <StaggerList className="col-span-12 flex flex-col">
        {blok.modules?.map((module, index) => (
          <div
            key={module._uid}
            className="border-border grid-12 border-t py-6 first:border-t-0 md:first:border-t"
          >
            <span className="text-label text-fg-muted col-span-2 md:col-span-1">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-label col-span-10 md:col-span-8">{module.title}</h3>
            {module.duration && (
              <span className="text-label text-fg-muted col-span-12 mt-2 md:col-span-3 md:mt-0 md:text-right">
                {module.duration}
              </span>
            )}
            {module.description && (
              <p className="text-body text-fg-muted col-span-12 col-start-1 mt-3 md:col-span-9 md:col-start-4">
                {module.description}
              </p>
            )}
          </div>
        ))}
      </StaggerList>
    </section>
  );
}
