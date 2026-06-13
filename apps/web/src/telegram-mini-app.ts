export interface TelegramMiniAppContext {
  isTelegramMiniApp: boolean;
  viewportHeight?: number;
  userName?: string;
}

interface TelegramWebAppUser {
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
  };
  platform?: string;
  version?: string;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isVersionAtLeast?(version: string): boolean;
  ready?(): void;
  expand?(): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  lockOrientation?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(eventType: 'viewportChanged', eventHandler: () => void): void;
  offEvent?(eventType: 'viewportChanged', eventHandler: () => void): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

function hasTelegramLaunchData(webApp: TelegramWebApp | undefined): webApp is TelegramWebApp {
  return Boolean(webApp && (webApp.initData || webApp.platform));
}

function canCall(webApp: TelegramWebApp, version: string) {
  return webApp.isVersionAtLeast ? webApp.isVersionAtLeast(version) : true;
}

function safeCall(fn: (() => void) | undefined) {
  try {
    fn?.();
  } catch (err) {
    console.warn('[telegram-mini-app] call failed', err);
  }
}

function resolveUserName(webApp: TelegramWebApp | undefined): string | undefined {
  const user = webApp?.initDataUnsafe?.user;
  if (!user) return undefined;
  return user.username || [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined;
}

export function readTelegramMiniAppContext(): TelegramMiniAppContext {
  const webApp = getTelegramWebApp();
  return {
    isTelegramMiniApp: hasTelegramLaunchData(webApp),
    viewportHeight: webApp?.viewportStableHeight || webApp?.viewportHeight,
    userName: resolveUserName(webApp),
  };
}

export function getTelegramViewportHeight(): number | undefined {
  const webApp = getTelegramWebApp();
  if (!hasTelegramLaunchData(webApp)) return undefined;
  return webApp.viewportStableHeight || webApp.viewportHeight;
}

export function bindTelegramViewportChange(handler: () => void): () => void {
  const webApp = getTelegramWebApp();
  if (!hasTelegramLaunchData(webApp) || !webApp.onEvent) return () => undefined;
  webApp.onEvent('viewportChanged', handler);
  return () => webApp.offEvent?.('viewportChanged', handler);
}

export function initializeTelegramMiniApp(): TelegramMiniAppContext {
  const webApp = getTelegramWebApp();
  const context = readTelegramMiniAppContext();

  if (!context.isTelegramMiniApp || !webApp) {
    return context;
  }

  safeCall(() => webApp.setHeaderColor?.('#07111f'));
  safeCall(() => webApp.setBackgroundColor?.('#07111f'));
  safeCall(() => webApp.expand?.());
  if (canCall(webApp, '7.7')) safeCall(() => webApp.disableVerticalSwipes?.());
  if (canCall(webApp, '8.0')) safeCall(() => webApp.requestFullscreen?.());
  if (canCall(webApp, '8.0')) safeCall(() => webApp.lockOrientation?.());
  safeCall(() => webApp.ready?.());

  return readTelegramMiniAppContext();
}
