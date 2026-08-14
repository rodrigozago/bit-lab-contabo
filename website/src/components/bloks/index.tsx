// Registro central dos bloks do Storyblok. Vive num arquivo próprio (sem
// importar src/lib/storyblok.ts) pra `lib/storyblok-init.ts` poder registrar
// esses componentes sem criar import circular com quem consome fetchStory().
import type { SbReactComponentsMap } from "@storyblok/react/rsc";

import { Page } from "./Page";
import { Hero } from "./Hero";
import { StackedHeadline } from "./StackedHeadline";
import { ProjectIndex } from "./ProjectIndex";
import { FeatureGrid } from "./FeatureGrid";
import { RichTextSection } from "./RichTextSection";
import { DataTable } from "./DataTable";
import { Cta } from "./Cta";
import { LogoMarquee } from "./LogoMarquee";
import { About } from "./About";
import { Contact } from "./Contact";
import { OnAirSlots } from "./OnAirSlots";
import { Label } from "./Label";
import { LabelIndex } from "./LabelIndex";
import { StudioCalendar } from "./StudioCalendar";
import { StudioContactForm } from "./StudioContactForm";

export const blokComponents: SbReactComponentsMap = {
  page: Page,
  hero: Hero,
  stacked_headline: StackedHeadline,
  project_index: ProjectIndex,
  feature_grid: FeatureGrid,
  rich_text: RichTextSection,
  data_table: DataTable,
  cta: Cta,
  logo_marquee: LogoMarquee,
  about: About,
  contact: Contact,
  on_air: OnAirSlots,
  label: Label,
  label_index: LabelIndex,
  studio_calendar: StudioCalendar,
  studio_contact: StudioContactForm,
};
