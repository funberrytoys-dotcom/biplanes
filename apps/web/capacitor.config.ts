import type { CapacitorConfig } from '@capacitor/cli';

// Native wrapper config (Capacitor). Wraps the built web app (apps/web/dist) into a
// real iOS/Android app — which gets a MUCH larger memory budget than a mobile browser
// tab (the cause of the run's mid-run white-screen crash), so the game can keep full
// graphics natively. The web build stays the browser/gh-pages test target.
const config: CapacitorConfig = {
  appId: 'com.funberrytoys.biplanes',
  appName: 'Biplanes',
  webDir: 'dist',
  backgroundColor: '#0a0e16',
  android: {
    // Game is a landscape, fullscreen experience; let the WebView fill the display.
    backgroundColor: '#0a0e16',
  },
};

export default config;
