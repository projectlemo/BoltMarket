import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The site is deployed as static files. `npm run build` runs `vite build` and then
// scripts/prerender.mjs, which renders every route (EN + AR) to its own index.html.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH ? `/${env.VITE_BASE_PATH.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/') : '/';
  return {
    base,
    plugins: [react(), tailwindcss()],
    build: {
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: true,
      reportCompressedSize: false,
    },
    server: { port: 5173 },
  };
});
