import type { Plane } from '@biplanes/core';

export type MissionOnePhase = 'briefing' | 'launch' | 'reveal' | 'escort' | 'ambush' | 'boss' | 'victory' | 'failure';

export interface MissionRadioEvent {
  id: string;
  at: number;
  speaker: string;
  text: string;
}

export interface MissionWave {
  id: string;
  at: number;
  count: number;
  label: string;
}

const ROUTE_DURATION_SEC = 220;
const BOSS_TIME_SEC = 180;

const RADIO_EVENTS: MissionRadioEvent[] = [
  { id: 'alarm', at: 1, speaker: 'Мира', text: 'Тревога на палубе! Караван с люменами выходит к маяку Бринн.' },
  { id: 'launch', at: 7, speaker: 'Мира', text: 'Чико, взлетай с авианосца. Камера каравана уже уходит вперед, держись рядом.' },
  { id: 'reveal', at: 20, speaker: 'Искрик', text: 'Вижу красные точки. Они быстрые, злые и явно без приглашения.' },
  { id: 'deck-clear', at: 34, speaker: 'Тотти', text: 'Палуба чиста! Теперь не дай им подойти к грузовым левиафанам.' },
  { id: 'first-crossing', at: 48, speaker: 'Мира', text: 'Проходим сквозь старый фарватер. Острова здесь далеко друг от друга, помощи ждать неоткуда.' },
  { id: 'escort', at: 70, speaker: 'Мира', text: 'Главная цель - караван. Пусть Шакалы гоняются за тобой, но не подпускай их к люменам.' },
  { id: 'mid-route', at: 94, speaker: 'Чико', text: 'Караван маленький на горизонте, но я его вижу. Свет не отдадим!' },
  { id: 'repair-warning', at: 112, speaker: 'Искрик', text: 'Если по каравану попадут еще раз, я лично прикручу броню к облакам.' },
  { id: 'ambush', at: 128, speaker: 'Искрик', text: 'Стая идет с двух высот. Одни отвлекают тебя, другие режут к каравану.' },
  { id: 'carrier-screen', at: 154, speaker: 'Мира', text: 'Справа красный авианосец! Он выпускает последнюю завесу перед маяком.' },
  { id: 'pre-boss', at: 172, speaker: 'Тотти', text: 'Впереди вспыхнул маяк Бринн... и что-то огромное закрывает свет.' },
  { id: 'boss', at: BOSS_TIME_SEC, speaker: 'Шрам', text: 'Маленькая ящерка, уступи дорогу стае. Люмены теперь наши.' },
  { id: 'boss-chico', at: BOSS_TIME_SEC + 3, speaker: 'Чико', text: 'Стая пусть летит в очередь. Я сегодня сопровождаю свет.' },
  { id: 'final-push', at: 206, speaker: 'Мира', text: 'Еще немного! Держи Шрама подальше, караван входит в световой коридор.' },
];

const WAVES: MissionWave[] = [
  { id: 'first-claws', at: 8, count: 2, label: 'Тревожный взлет' },
  { id: 'deck-raiders', at: 32, count: 2, label: 'Налет у палубы' },
  { id: 'high-dive', at: 44, count: 3, label: 'Удар с высоты' },
  { id: 'crossfire', at: 62, count: 3, label: 'Перекрестный огонь' },
  { id: 'caravan-hunters', at: 82, count: 3, label: 'Охотники за люменами' },
  { id: 'fog-cutters', at: 112, count: 3, label: 'Резчики тумана' },
  { id: 'underbelly', at: 126, count: 4, label: 'Клещи стаи' },
  { id: 'carrier-screen', at: 154, count: 4, label: 'Завеса авианосца' },
  { id: 'last-screen', at: 166, count: 3, label: 'Последний заслон' },
];

export function createMissionOneController() {
  let timeSec = 0;
  let caravanHp = 1;
  let phase: MissionOnePhase = 'briefing';
  const shownRadio = new Set<string>();
  const spawnedWaves = new Set<string>();
  let bossSpawned = false;
  let bossRetreatForced = false;
  let emergencyRepairTriggered = false;
  let bossId: number | null = null;

  function reset() {
    timeSec = 0;
    caravanHp = 1;
    phase = 'briefing';
    shownRadio.clear();
    spawnedWaves.clear();
    bossSpawned = false;
    bossRetreatForced = false;
    emergencyRepairTriggered = false;
    bossId = null;
  }

  function computePhase(): MissionOnePhase {
    if (caravanHp <= 0) return 'failure';
    if (timeSec < 8) return 'launch';
    if (timeSec < 28) return 'reveal';
    if (timeSec < 118) return 'escort';
    if (timeSec < 176) return 'ambush';
    return 'boss';
  }

  function update(dt: number, currentCaravanHp: number, bossAlive: boolean) {
    if (phase === 'victory' || phase === 'failure') return;
    timeSec += dt;
    caravanHp = currentCaravanHp;

    if (caravanHp <= 0) {
      phase = 'failure';
    } else if (timeSec >= ROUTE_DURATION_SEC && !bossAlive) {
      phase = 'victory';
    } else {
      phase = computePhase();
    }
  }

  function consumeRadio(): MissionRadioEvent | null {
    for (const event of RADIO_EVENTS) {
      if (!shownRadio.has(event.id) && timeSec >= event.at) {
        shownRadio.add(event.id);
        return event;
      }
    }
    return null;
  }

  function consumeWaves(): MissionWave[] {
    const ready: MissionWave[] = [];
    for (const wave of WAVES) {
      if (!spawnedWaves.has(wave.id) && timeSec >= wave.at) {
        spawnedWaves.add(wave.id);
        ready.push(wave);
      }
    }
    return ready;
  }

  function shouldSpawnBoss(): boolean {
    if (bossSpawned || timeSec < BOSS_TIME_SEC) return false;
    bossSpawned = true;
    return true;
  }

  function shouldForceBossRetreat(): boolean {
    if (bossRetreatForced || timeSec < ROUTE_DURATION_SEC || caravanHp <= 0) return false;
    bossRetreatForced = true;
    return true;
  }

  function shouldTriggerEmergencyRepair(): boolean {
    if (emergencyRepairTriggered || caravanHp <= 0 || caravanHp > 0.35 || timeSec < 28) return false;
    emergencyRepairTriggered = true;
    return true;
  }

  function registerBoss(id: number) {
    bossId = id;
  }

  function isBossAlive(enemies: readonly Plane[]): boolean {
    if (bossId === null) return false;
    const boss = enemies.find((enemy) => enemy.id === bossId);
    return Boolean(boss && boss.alive && boss.state !== 'crashed');
  }

  function routeProgress(): number {
    return Math.max(0, Math.min(1, timeSec / ROUTE_DURATION_SEC));
  }

  function revealAmount(): number {
    return Math.max(0, Math.min(1, (timeSec - 7) / 18));
  }

  function launchAssistActive(): boolean {
    return timeSec < 5.5;
  }

  function markVictory() {
    phase = 'victory';
  }

  function fastForward(targetSec: number) {
    if (targetSec <= timeSec) return;
    timeSec = targetSec;
    for (const e of RADIO_EVENTS) if (e.at < targetSec) shownRadio.add(e.id);
    for (const w of WAVES) if (w.at < targetSec) spawnedWaves.add(w.id);
    if (targetSec >= BOSS_TIME_SEC) bossSpawned = true;
    if (targetSec < ROUTE_DURATION_SEC) bossRetreatForced = false;
    phase = computePhase();
  }

  return {
    reset,
    update,
    consumeRadio,
    consumeWaves,
    shouldSpawnBoss,
    shouldForceBossRetreat,
    shouldTriggerEmergencyRepair,
    registerBoss,
    isBossAlive,
    markVictory,
    fastForward,
    launchAssistActive,
    get timeSec() { return timeSec; },
    get phase() { return phase; },
    get caravanHp() { return caravanHp; },
    get routeProgress() { return routeProgress(); },
    get revealAmount() { return revealAmount(); },
    get bossId() { return bossId; },
  };
}
