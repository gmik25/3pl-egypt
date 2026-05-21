import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@3pl/shared': path.resolve(__dirname, '../../packages/shared/src'),
      },
    },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
