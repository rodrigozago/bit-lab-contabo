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

export interface LogoMarqueeBlok extends SectionBlok {
  component: "logo_marquee";
  heading?: string;
  logos?: LogoItemBlok[];
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
export interface OpencdjConfigStoryContent extends SbBlokData {
  component: "opencdj_config";
  headline: string;
  subheadline: string;
  description: string;
  manifesto: object;
  name_label: string;
  name_placeholder: string;
  contact_label: string;
  contact_placeholder: string;
  genre_label: string;
  genre_placeholder: string;
  submit_text: string;
  success_message: string;
  hero_video_mp4?: StoryblokImage;
  hero_video_webm?: StoryblokImage;
  logo?: StoryblokImage;
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
