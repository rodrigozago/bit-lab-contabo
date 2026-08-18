import {
  History,
  Image,
  Layers,
  Circle,
  PenTool,
  FileDown,
  PlayCircle,
  Frame,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Item,
  ItemDescription,
  ItemIcon,
  ItemTitle,
} from "@/components/ui/item";
import { Section } from "@/components/ui/section";

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: "Foto vira vetor",
    description:
      "Envie uma foto e o Bordado Digital separa as cores em regiões prontas pra bordar.",
    icon: <Image className="size-5 stroke-1" />,
  },
  {
    title: "Tipos de ponto",
    description:
      "Cetim, tatami e corrido — escolha o preenchimento ideal pra cada área do desenho.",
    icon: <Circle className="size-5 stroke-1" />,
  },
  {
    title: "Camadas estilo Photoshop",
    description:
      "Organize o bordado em camadas, reordene, esconda e ajuste cada elemento.",
    icon: <Layers className="size-5 stroke-1" />,
  },
  {
    title: "Bastidores populares",
    description:
      "Presets dos bastidores das máquinas mais usadas pra você não errar o tamanho.",
    icon: <Frame className="size-5 stroke-1" />,
  },
  {
    title: "Simulador de costura",
    description:
      "Veja o caminho da agulha ponto a ponto antes de mandar pra máquina.",
    icon: <PlayCircle className="size-5 stroke-1" />,
  },
  {
    title: "Exportação completa",
    description:
      "Gere arquivos DST, PES, JEF e SVG compatíveis com o seu equipamento.",
    icon: <FileDown className="size-5 stroke-1" />,
  },
  {
    title: "Histórico automático",
    description:
      "Cada alteração é salva — volte pra qualquer versão do seu projeto quando quiser.",
    icon: <History className="size-5 stroke-1" />,
  },
  {
    title: "Caneta vetorial",
    description:
      "Prefere desenhar na mão? Use a caneta vetorial (curvas Bézier) pra criar áreas personalizadas do zero, sem depender só da análise automática.",
    icon: <PenTool className="size-5 stroke-1" />,
  },
];

export function Features() {
  return (
    <Section id="recursos">
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <h2 className="max-w-[560px] text-center text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
          Tudo que você precisa pra digitalizar
        </h2>
        <div className="grid auto-rows-fr grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Item key={feature.title}>
              <ItemIcon className="text-brand">{feature.icon}</ItemIcon>
              <ItemTitle>{feature.title}</ItemTitle>
              <ItemDescription>{feature.description}</ItemDescription>
            </Item>
          ))}
        </div>
      </div>
    </Section>
  );
}
