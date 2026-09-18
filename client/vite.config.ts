import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import Icons from "unplugin-icons/vite";
import { defineConfig, loadEnv } from "vite";

const SUPPORTED_SERVER = ">=1.9.0";

const mobileHost = process.env.TAURI_DEV_HOST;

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "GOOGLE_");

  return {
    plugins: [svelte(), tailwindcss(), Icons({ compiler: "svelte" })],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __SUPPORTED_SERVER__: JSON.stringify(SUPPORTED_SERVER),
      __GOOGLE_OAUTH__: JSON.stringify({
        desktopId: env.GOOGLE_CLIENT_ID_DESKTOP ?? "",
        desktopSecret: env.GOOGLE_CLIENT_SECRET_DESKTOP ?? "",
        androidId: env.GOOGLE_CLIENT_ID_ANDROID ?? "",
        webId: env.GOOGLE_CLIENT_ID_WEB ?? "",
      }),
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
  };
});
