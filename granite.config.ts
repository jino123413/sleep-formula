import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'sleep-formula',
  web: {
    host: '0.0.0.0',
    port: 3002,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
  brand: {
    displayName: '수면 공식',
    icon: 'https://raw.githubusercontent.com/jino123413/app-logos/master/sleep-formula.png',
    primaryColor: '#4F46E5',
    bridgeColorMode: 'basic',
  },
  webViewProps: {
    type: 'partner',
  },
});
