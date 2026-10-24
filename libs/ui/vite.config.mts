import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/libs/ui',
    emptyOutDir: false,
    lib: { entry: 'libs/ui/src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'styles' },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-aria-components',
        '@torob-ticket/domain',
        '@torob-ticket/contracts',
      ],
    },
  },
});
