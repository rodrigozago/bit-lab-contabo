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
