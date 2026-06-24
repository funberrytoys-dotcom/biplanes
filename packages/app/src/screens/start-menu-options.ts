export type MenuAction = 'flightLab' | 'campaign' | 'arena' | 'run' | 'multiplayer' | 'settings' | 'exit';

export interface StartMenuOption {
  action: MenuAction;
  label: string;
  note: string;
  enabled: boolean;
}

export function getStartMenuOptions(): StartMenuOption[] {
  return [
    {
      action: 'campaign',
      label: 'КАМПАНИЯ',
      note: 'Сюжетные миссии: Уровень 1 (первый вылет) и демо-бой с дирижаблем «Волчья комета». Сюда добавляем новые уровни.',
      enabled: true,
    },
    {
      action: 'arena',
      label: 'АРЕНА',
      note: 'Быстрый боевой режим: победы, улучшения, разные небесные локации и чистая проверка билда.',
      enabled: true,
    },
    {
      action: 'run',
      label: 'ЗАБЕГ',
      note: '15 волн, одна жизнь. После каждой волны — выбор модуля из 4 веток с цветным выделением, реролл и пропуск. На финале — босс «Шрам».',
      enabled: true,
    },
    {
      action: 'flightLab',
      label: 'УЧЕБНЫЙ ПОЛЁТ',
      note: 'внутренний режим настройки: газ, срыв, пикирование, восстановление. Для доводки ощущения самолёта.',
      enabled: true,
    },
    {
      action: 'multiplayer',
      label: 'МУЛЬТИПЛЕЕР',
      note: 'Будущий режим воздушных дуэлей. Сначала доводим одиночную игру.',
      enabled: false,
    },
    {
      action: 'settings',
      label: 'НАСТРОЙКИ',
      note: 'Управление сейчас: W, A/D, Space, Shift = форсаж, B = бомба.',
      enabled: false,
    },
    {
      action: 'exit',
      label: 'ВЫХОД',
      note: 'Закрыть игру. В Telegram — закрывает мини-приложение; в браузере — вкладку.',
      enabled: true,
    },
  ];
}
