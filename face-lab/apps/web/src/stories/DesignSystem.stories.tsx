import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Design System/Tokens",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

function Swatch({ name, varName, hex, note }: { name: string; varName: string; hex: string; note?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-14 w-14 shrink-0 rounded-lg border" style={{ background: hex }} />
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">
          <code className="font-mono text-xs">{varName}</code> · {hex}
          {note && <span> — {note}</span>}
        </p>
      </div>
    </div>
  );
}

export const Cores: Story = {
  render: () => (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="heading-editorial text-2xl">Sete papéis (BRAND.md)</h2>
        <div className="mt-4 space-y-3">
          <Swatch name="Background — Off-White" varName="--background" hex="#fafaf9" note="canvas principal" />
          <Swatch name="Surface — Very Light" varName="--secondary / --muted" hex="#f5f5f5" note="cards, seções, skeletons" />
          <Swatch name="Foreground — Preto Deep" varName="--foreground / --primary" hex="#1a1a1a" note="headlines, body, botões" />
          <Swatch name="Muted — Medium Gray" varName="--muted-foreground" hex="#8a8a8a" note="captions, helpers" />
          <Swatch name="Border — Light" varName="--border / --input" hex="#d0d0d0" note="réguas, inputs" />
          <Swatch name="Accent — Ouro Sofisticado" varName="--accent" hex="#d4a574" note="máx 1–2 momentos por tela" />
          <Swatch name="Accent Secondary — Azul" varName="--accent-secondary" hex="#4a6fa5" note="links, ações secundárias" />
        </div>
      </div>

      <div>
        <h2 className="heading-editorial text-2xl">Tokens de produto</h2>
        <div className="mt-4 space-y-3">
          <Swatch name="Success" varName="--success" hex="#2d5016" note="confirmações" />
          <Swatch name="Success Light" varName="--success-light" hex="#7cb342" note="ícones grandes" />
          <Swatch name="Error" varName="--destructive" hex="#a94442" />
          <Swatch name="FREE badge" varName="--free-badge" hex="#d1fae5" note="fg #065f46" />
          <Swatch name="Gold hover" varName="--accent-hover" hex="#8b7355" />
          <Swatch name="Gold light" varName="--accent-light" hex="#e8d4c0" note="glow de reconhecimento" />
        </div>
      </div>

      <div>
        <h2 className="heading-editorial text-2xl">Dark museum</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Classe escopada <code className="font-mono text-xs">.dark-museum</code> — heroes de marketing.
        </p>
        <div className="dark-museum mt-4 rounded-lg bg-background p-6 text-foreground">
          <p className="text-2xl font-extrabold tracking-tighter">FACE LAB</p>
          <p className="mt-1 text-muted-foreground">
            Encontre suas fotos. <span className="text-accent">Automaticamente.</span>
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <Swatch name="Background" varName="--background" hex="#1a1a1a" />
            <Swatch name="Surface" varName="--card / --secondary" hex="#2a2a2a" />
            <Swatch name="Border" varName="--border" hex="#404040" />
            <Swatch name="Muted" varName="--muted-foreground" hex="#a0a0a0" />
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Tipografia: Story = {
  render: () => (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Display / Hero — Inter 700 · 48–64px</p>
        <p className="text-6xl font-extrabold tracking-tighter">FACE LAB</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Heading editorial — Inter 400 · 2–2.75rem</p>
        <p className="heading-editorial">Minhas fotos</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">H2 — 28px · 700</p>
        <p className="text-[28px] font-bold leading-[1.3]">Seus Álbuns</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Body — 16px · 400 · lh 1.6</p>
        <p className="text-base leading-[1.6]">
          Cadastre seu rosto uma vez e receba, sozinho, todas as fotos em que você aparece.
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Small — 14px · 400</p>
        <p className="text-sm text-muted-foreground">As fotos originais nunca saem do Google Drive do fotógrafo.</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Caption — 12px · 400</p>
        <p className="text-xs text-muted-foreground">47 fotos · 12 pessoas</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Nav — 13px · caps · tracking-widest</p>
        <p className="w-fit border-b border-foreground pb-1 text-[13px] uppercase tracking-widest">Minhas Fotos</p>
      </div>
    </div>
  ),
};
