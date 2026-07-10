/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROLLBAR_ACCESS_TOKEN?: string;
  readonly VITE_ROLLBAR_MIN_LEVEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
