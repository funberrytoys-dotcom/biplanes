import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/biplanes/' : '/',
  server: { host: true, port: 5173 },
  build: { target: 'es2022' },
});
