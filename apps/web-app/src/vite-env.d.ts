/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_GATEWAY_URL: string;
  readonly VITE_CONTROL_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
