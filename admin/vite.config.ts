import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VITE_BASE_PATH=bolt-markets/admin serves the back office from https://<user>.github.io/bolt-markets/admin/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = (env.VITE_BASE_PATH || '').replace(/^\/+|\/+$/g, '');
  return {
    base: base ? `/${base}/` : '/',
    plugins: [react(), tailwindcss()],
    // shared, dependency-free helpers (QR encoder, Markdown renderer) live in ../frontend
    server: { port: 5174, fs: { allow: ['..'] } },
    build: { target: 'es2022', sourcemap: false },
  };
});
