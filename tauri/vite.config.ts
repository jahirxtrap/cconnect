import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const SUPPORTED_SERVER = ">=1.4.0";

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
  server: { port: 1420, strictPort: true },
  build: { target: "es2022" },
});
