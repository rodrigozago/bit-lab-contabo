import type { Meta, StoryObj } from "@storybook/react";
import { Check } from "lucide-react";

const meta: Meta = {
  title: "Design System/Reconhecimento (Quiet AI)",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

function DemoPhoto({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] w-72 overflow-hidden rounded-lg bg-secondary">
      <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-muted-foreground">
        foto
      </div>
      {children}
    </div>
  );
}

export const FaceBoxes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      <figure>
        <DemoPhoto>
          {/* confirmado: borda ouro + glow suave (accent-light) — sem % de confiança */}
          <div
            className="absolute border-2 border-accent shadow-[0_0_12px_2px_var(--accent-light)]"
            style={{ left: "35%", top: "20%", width: "30%", height: "42%" }}
          />
        </DemoPhoto>
        <figcaption className="mt-2 flex items-center gap-1 text-xs">
          <span className="flex items-center gap-1 font-medium text-success">
            <Check size={13} /> Você
          </span>
          <span className="text-muted-foreground">— confirmado (ouro + glow)</span>
        </figcaption>
      </figure>

      <figure>
        <DemoPhoto>
          {/* pendente: azul sofisticado translúcido */}
          <div
            className="absolute border-2 border-accent-secondary/70"
            style={{ left: "35%", top: "20%", width: "30%", height: "42%" }}
          />
        </DemoPhoto>
        <figcaption className="mt-2 text-xs text-muted-foreground">pendente (azul) — "Sou eu?"</figcaption>
      </figure>
    </div>
  ),
};
