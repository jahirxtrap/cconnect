import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const SUPPORTED_SERVER = ">=1.6.4";

const mobileHost = process.env.TAURI_DEV_HOST;

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __SUPPORTED_SERVER__: JSON.stringify(SUPPORTED_SERVER),
  },
  resolve: {
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  clearScreen: false,
  server: {
    host: mobileHost || false,
    port: 1420,
    strictPort: true,
    hmr: mobileHost ? { protocol: "ws", host: mobileHost, port: 1421 } : undefined,
  },
  build: { target: "es2022" },
});
