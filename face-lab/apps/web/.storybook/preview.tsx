import React from "react";
import type { Preview } from "@storybook/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "off-white",
      values: [
        { name: "off-white", value: "#fafaf9" },
        { name: "surface", value: "#f5f5f5" },
        { name: "dark-museum", value: "#1a1a1a" },
      ],
    },
    options: {
      storySort: {
        order: ["Design System", "UI", "Fluxos", "*"],
      },
    },
  },
  decorators: [
    // canvas escuro selecionado → aplica .dark-museum, senão o botão default
    // (preto) fica invisível sobre #1a1a1a; os tokens re-resolvem no escopo
    (Story, context) => {
      const bg = context.globals?.backgrounds?.value as string | undefined;
      const dark = bg === "#1a1a1a";
      return (
        <div className={dark ? "dark-museum" : undefined} style={{ color: "var(--foreground)" }}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
