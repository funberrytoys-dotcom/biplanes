export type MenuAction = 'flightLab' | 'story' | 'arena' | 'run' | 'multiplayer' | 'settings' | 'exit';

export interface StartMenuOption {
  action: MenuAction;
  label: string;
  note: string;
  enabled: boolean;
}

export function getStartMenuOptions(): StartMenuOption[] {
  return [
    {
      action: 'story',
      label: 'ПЕРВЫЙ ВЫЛЕТ',
      note: 'Сюжетный старт полноценной игры: взлет, первый бой, первый апгрейд и защита каравана у маяка.',
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
      note: 'В браузерной версии выход закрывается вкладкой.',
      enabled: false,
    },
  ];
}
