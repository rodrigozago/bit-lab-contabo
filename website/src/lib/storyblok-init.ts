import "server-only";
import { apiPlugin, storyblokInit } from "@storyblok/react/rsc";
import { blokComponents } from "@/components/bloks";

// Módulo de efeito colateral — chamado uma vez por processo, importado no
// topo de app/layout.tsx (o server component raiz) antes de qualquer
// getStoryblokApi()/StoryblokStory ser usado. O client inicializa com o
// token público; fetchStory() (src/lib/storyblok.ts) sobrescreve `token`
// por request quando o draft mode está ligado — não precisa reinicializar.
storyblokInit({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN,
  use: [apiPlugin],
  apiOptions: {
    region: "eu",
  },
  components: blokComponents,
});
