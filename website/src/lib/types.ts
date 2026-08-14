import type { SbBlokData } from "@storyblok/react/rsc";

/** Valores do campo `visibility`, presente em `page` e `project`. Ver src/lib/access.ts. */
export type Visibility = "public" | "unlisted" | "private";

export type Theme = "dark" | "light";

export interface SeoFields {
  seo_title?: string;
  seo_description?: string;
  og_image?: { filename?: string; alt?: string };
}

export interface PageStoryContent extends SbBlokData, SeoFields {
  component: "page";
  title?: string;
  visibility?: Visibility;
  body?: SbBlokData[];
}

export interface ProjectStoryContent extends SbBlokData, SeoFields {
  component: "project";
  title?: string;
  visibility?: Visibility;
  client?: string;
  year?: string;
  roles?: string;
  stack?: string;
  cover?: { filename?: string; alt?: string };
  gallery?: { filename?: string; alt?: string }[];
  excerpt?: string;
  body?: SbBlokData[];
}

export interface NavLink {
  _uid: string;
  label: string;
  link: { url?: string; cached_url?: string; linktype?: string };
}

export interface ConfigStoryContent extends SbBlokData {
  component: "config";
  main_nav?: NavLink[];
  footer_nav?: NavLink[];
  socials?: NavLink[];
  contact_email?: string;
}

export type StoryblokImage = { filename?: string; alt?: string };
export type StoryblokLink = { url?: string; cached_url?: string; linktype?: string };

/** Todo blok de seção carrega seu próprio tema — é o que permite alternar
 * painéis claros/escuros ao longo do scroll (ver globals.css theme--*). */
interface SectionBlok extends SbBlokData {
  theme?: Theme;
}

export interface HeroBlok extends SectionBlok {
  component: "hero";
  eyebrow?: string;
  headline: string;
  subline?: string;
  cta_label?: string;
  cta_link?: StoryblokLink;
  background?: StoryblokImage;
}

export interface StackedHeadlineBlok extends SectionBlok {
  component: "stacked_headline";
  headline: string;
}

export interface ProjectIndexBlok extends SectionBlok {
  component: "project_index";
  heading?: string;
}

export interface FeatureBlok extends SbBlokData {
  component: "feature";
  title: string;
  description?: string;
}

export interface FeatureGridBlok extends SectionBlok {
  component: "feature_grid";
  heading?: string;
  features?: FeatureBlok[];
}

export interface RichTextSectionBlok extends SectionBlok {
  component: "rich_text";
  content: object;
}

export interface DataTableRowBlok extends SbBlokData {
  component: "data_table_row";
  col_1?: string;
  col_2?: string;
  col_3?: string;
  col_4?: string;
}

export interface DataTableBlok extends SectionBlok {
  component: "data_table";
  heading?: string;
  headers?: string;
  rows?: DataTableRowBlok[];
}

export interface CtaBlok extends SectionBlok {
  component: "cta";
  headline: string;
  label?: string;
  link?: StoryblokLink;
}

export interface LogoItemBlok extends SbBlokData {
  component: "logo_item";
  name: string;
  logo?: StoryblokImage;
}

/** Banner CTA genérico com imagem de fundo — reutilizável em qualquer
 * página (site principal ou studio), sem nada específico embutido. */
export interface CtaBannerBlok extends SectionBlok {
  component: "cta_banner";
  headline: string;
  cta_label: string;
  cta_link?: StoryblokLink;
  background_image?: StoryblokImage;
}

export interface LogoMarqueeBlok extends SectionBlok {
  component: "logo_marquee";
  heading?: string;
  logos?: LogoItemBlok[];
}

/** Um cartão de plano — ex. "Club de Membros" na página de preços.
 * `benefits` é texto livre, um item por linha (mesma convenção de
 * `headers` em DataTableBlok: string simples, sem precisar de outro blok
 * nestable só pra lista de bullets). */
export interface PricingPlanBlok extends SbBlokData {
  component: "pricing_plan";
  name: string;
  price: string;
  price_note?: string;
  benefits?: string;
  cta_label?: string;
  cta_url?: string;
}

export interface PricingPlansBlok extends SectionBlok {
  component: "pricing_plans";
  heading?: string;
  plans?: PricingPlanBlok[];
}

export interface AboutBlok extends SectionBlok {
  component: "about";
  eyebrow?: string;
  headline: string;
  bio: object;
  photo?: StoryblokImage;
  pillars?: FeatureBlok[];
}

export interface ContactBlok extends SectionBlok {
  component: "contact";
  heading: string;
  intro?: string;
  /** Sobrescreve o `contact_email` da story global "config" quando preenchido. */
  email?: string;
  phone?: string;
}

/** Story raiz, pasta `on-air-slots/` — um set de DJ. Sem `visibility`: nunca é
 * buscada por slug individual, só em lote por `content_type`/`starts_with`;
 * despublicar no Storyblok já esconde o slot. */
export interface OnAirSlotStoryContent extends SbBlokData {
  component: "on_air_slot";
  artist: string;
  genre?: string;
  photo?: StoryblokImage;
  instagram?: string;
  /** Campo Date/Time do Storyblok — horário de parede de São Paulo, sem fuso
   * embutido na string. Convertido em src/lib/onair-time.ts. */
  starts_at?: string;
  ends_at?: string;
}

/** Blok nestable, zero campos — nem `theme`: a seção nunca participa do
 * claro/escuro do resto do site, mantém a identidade Klein Blue própria. */
export interface OnAirBlok extends SbBlokData {
  component: "on_air";
}

/** Story singleton, slug "opencdj-config" — copy + labels do form da página
 * /opencdj. Excluída do catch-all/sitemap (ver excluding_slugs), igual ao
 * padrão de "config". Vídeo/logo do hero são Assets do Storyblok, não
 * arquivos estáticos — trocáveis sem deploy. */
// name_label/name_placeholder/contact_label/contact_placeholder existiam aqui
// antes de nome/instagram/whatsapp virarem dados da conta (sessão SSO) em vez
// de campos livres do form — ficaram sem uso. Podem continuar existindo na
// story do Storyblok sem problema (só não são mais lidos daqui).
export interface OpencdjConfigStoryContent extends SbBlokData {
  component: "opencdj_config";
  headline: string;
  subheadline: string;
  description: string;
  manifesto: object;
  genre_label: string;
  genre_placeholder: string;
  submit_text: string;
  success_message: string;
  hero_video_mp4?: StoryblokImage;
  hero_video_webm?: StoryblokImage;
  logo?: StoryblokImage;
}

/** Story raiz, pasta `studio/labels/` — um selo/coletivo do studio (ex.
 * Pista Oculta). Página de detalhe própria, renderizada por
 * components/bloks/Label.tsx (registrado como "label" em bloks/index.tsx —
 * diferente de "project", que não tem componente raiz registrado hoje). */
export interface LabelStoryContent extends SbBlokData, SeoFields {
  component: "label";
  name: string;
  tagline?: string;
  bio: object;
  photo?: StoryblokImage;
  instagram?: string;
  genres?: string;
  visibility?: Visibility;
}

/** Blok — vitrine dos labels na landing do studio. Busca sozinho via
 * content_type "label", mesmo padrão do ProjectIndexBlok. */
export interface LabelIndexBlok extends SectionBlok {
  component: "label_index";
  heading?: string;
}

/** Story raiz, pasta `studio-events/` (fora de `studio/`, mesmo padrão de
 * `on-air-slots/`) — um evento/showcase de algum label do studio. Nunca
 * buscada por slug individual, só em lote pelo StudioCalendar. starts_at/
 * ends_at são campos Date/Time do Storyblok — horário de parede de São
 * Paulo, convertidos com spWallToUtcIso() de src/lib/onair-time.ts. */
export interface StudioEventStoryContent extends SbBlokData {
  component: "studio_event";
  title: string;
  label_name?: string;
  starts_at: string;
  ends_at?: string;
  location?: string;
  description?: string;
  link?: string;
  cover?: StoryblokImage;
}

/** Blok — calendário de próximos eventos na landing do studio. */
export interface StudioCalendarBlok extends SectionBlok {
  component: "studio_calendar";
  heading?: string;
}

/** Blok — form de contato público (não confundir com ContactBlok, que é só
 * display de email/telefone). Submete pra POST /contact/submit, que notifica
 * via Slack (website/src/lib/slack.ts notifyStudioContact) — sem sessão
 * exigida, ao contrário do form do /opencdj. */
export interface StudioContactBlok extends SectionBlok {
  component: "studio_contact";
  heading: string;
  intro?: string;
}

/** Blok nestable — um módulo do programa do curso de discotecagem. */
export interface CourseModuleBlok extends SbBlokData {
  component: "course_module";
  title: string;
  description?: string;
  duration?: string;
}

/** Blok — programa/currículo do curso, lista de módulos editável no
 * Storyblok (campo Blocks restrito a course_module). */
export interface CourseCurriculumBlok extends SectionBlok {
  component: "course_curriculum";
  heading?: string;
  modules?: CourseModuleBlok[];
}

/** Blok — form de inscrição no curso. Renderizado por
 * components/bloks/CourseSignupForm.tsx, que decide entre login gate,
 * perfil incompleto ou o form de verdade conforme getStudioSession()
 * (ver StudioLoginGate/StudioIncompleteProfile em components/studio/).
 * `experience_options` é texto comma-separated, mesma convenção de
 * DataTableBlok.headers/PricingPlanBlok.benefits — evita precisar de
 * outro blok nestable só pra um select. */
export interface CourseSignupFormBlok extends SectionBlok {
  component: "course_signup_form";
  heading: string;
  intro?: string;
  experience_label: string;
  experience_options: string;
  motivation_label: string;
  motivation_placeholder?: string;
  submit_text: string;
  success_message: string;
  return_to?: string;
}

/** Forma já processada de um slot — o que cruza a fronteira server→client em
 * OnAirClient.tsx. Só ISO strings, nada de `Date` (precisa ser serializável). */
export interface OnAirSlotView {
  uid: string;
  artist: string;
  genre?: string;
  photoUrl?: string;
  photoAlt?: string;
  /** Como foi cadastrado (@usuario ou URL) — formatar com formatInstagramHandle(). */
  instagramRaw?: string;
  instagramUrl?: string;
  startsAtIso: string;
  endsAtIso: string;
}
