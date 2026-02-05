import { useState, useCallback, useMemo, useEffect } from 'react';
import { nanoid } from 'nanoid';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SleepRecord {
  id: string;
  date: string;        // YYYY-MM-DD
  bedtime: string;     // HH:mm
  wakeTime: string;    // HH:mm
  hoursSlept: number;  // calculated
}

export interface CaffeineEntry {
  id: string;
  timestamp: number;   // Date.now()
  amountMg: number;
  type: 'coffee' | 'espresso' | 'tea' | 'energy' | 'other';
  label: string;
}

export interface OptimalTime {
  time: string;   // HH:mm
  cycles: number; // 1-6
  hours: number;  // total hours of sleep
  quality: 'poor' | 'fair' | 'good' | 'great';
}

export interface SleepDebtResult {
  daily: { day: string; dayLabel: string; hours: number; debt: number }[];
  totalDebt: number;
  avgHours: number;
}

export interface SleepTip {
  icon: string;       // remixicon class
  title: string;
  description: string;
}

export interface SleepStats {
  totalRecords: number;
  avgHoursThisWeek: number;
  totalDebtHours: number;
  longestSleep: number;
  shortestSleep: number;
  avgBedtime: string;
  avgWakeTime: string;
  currentCaffeineMg: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SLEEP_CYCLE_MINUTES = 90;
const FALL_ASLEEP_MINUTES = 15;
const CAFFEINE_HALF_LIFE_HOURS = 5;

const STORAGE_KEYS = {
  RECORDS: 'sleep-formula-records',
  CAFFEINE: 'sleep-formula-caffeine',
  RECOMMENDED: 'sleep-formula-recommended',
} as const;

const DEFAULT_RECOMMENDED_HOURS = 8;

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

// ─────────────────────────────────────────────
// Pure utility functions
// ─────────────────────────────────────────────

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h, minutes: m };
}

export function formatTime(totalMinutes: number): string {
  const absMinutes = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return DAY_LABELS[date.getDay()];
}

function padTime(hours: number, minutes: number): string {
  const h = ((hours % 24) + 24) % 24;
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

function calculateHoursSlept(bedtime: string, wakeTime: string): number {
  const bedMinutes = timeToMinutes(bedtime);
  let wakeMinutes = timeToMinutes(wakeTime);

  // Handle overnight case: if wake time is earlier than bedtime,
  // it means the person slept past midnight
  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += 24 * 60;
  }

  const diffMinutes = wakeMinutes - bedMinutes;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

function qualityFromCycles(cycles: number): 'poor' | 'fair' | 'good' | 'great' {
  if (cycles <= 2) return 'poor';
  if (cycles === 3) return 'fair';
  if (cycles === 4) return 'good';
  return 'great';
}

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const { hours, minutes } = parseTime(timeStr);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const resultHours = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const resultMinutes = ((totalMinutes % 1440) + 1440) % 1440 % 60;
  return padTime(resultHours, resultMinutes);
}

function subtractMinutesFromTime(timeStr: string, minutesToSubtract: number): string {
  return addMinutesToTime(timeStr, -minutesToSubtract);
}

function averageTimeStr(times: string[]): string {
  if (times.length === 0) return '00:00';

  // Convert all times to minutes, using circular mean to handle midnight crossover
  const radians = times.map((t) => {
    const mins = timeToMinutes(t);
    return (mins / 1440) * 2 * Math.PI;
  });

  const sinSum = radians.reduce((sum, r) => sum + Math.sin(r), 0);
  const cosSum = radians.reduce((sum, r) => sum + Math.cos(r), 0);

  let avgRad = Math.atan2(sinSum / times.length, cosSum / times.length);
  if (avgRad < 0) avgRad += 2 * Math.PI;

  const avgMinutes = Math.round((avgRad / (2 * Math.PI)) * 1440);
  const h = Math.floor(avgMinutes / 60);
  const m = avgMinutes % 60;
  return padTime(h, m);
}

// ─────────────────────────────────────────────
// Exported pure functions
// ─────────────────────────────────────────────

export function calculateOptimalTimes(
  targetTime: string,
  mode: 'bedtime' | 'wakeup'
): OptimalTime[] {
  const results: OptimalTime[] = [];

  if (mode === 'bedtime') {
    // Given a wake-up time, calculate optimal bedtimes.
    // Work backwards from 6 cycles down to 1 cycle.
    for (let cycles = 6; cycles >= 1; cycles--) {
      const sleepMinutes = cycles * SLEEP_CYCLE_MINUTES;
      const totalMinutes = sleepMinutes + FALL_ASLEEP_MINUTES;
      const bedtime = subtractMinutesFromTime(targetTime, totalMinutes);
      results.push({
        time: bedtime,
        cycles,
        hours: Math.round((sleepMinutes / 60) * 100) / 100,
        quality: qualityFromCycles(cycles),
      });
    }
  } else {
    // Given a bedtime, calculate optimal wake-up times.
    // Work forwards from 1 cycle up to 6 cycles.
    for (let cycles = 1; cycles <= 6; cycles++) {
      const sleepMinutes = cycles * SLEEP_CYCLE_MINUTES;
      const totalMinutes = sleepMinutes + FALL_ASLEEP_MINUTES;
      const wakeTime = addMinutesToTime(targetTime, totalMinutes);
      results.push({
        time: wakeTime,
        cycles,
        hours: Math.round((sleepMinutes / 60) * 100) / 100,
        quality: qualityFromCycles(cycles),
      });
    }
  }

  return results;
}

export function calculateCaffeineLevel(
  entries: CaffeineEntry[],
  atTime: Date = new Date()
): number {
  const atMs = atTime.getTime();

  let total = 0;
  for (const entry of entries) {
    const elapsedMs = atMs - entry.timestamp;
    if (elapsedMs < 0) continue; // future entries ignored
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const remaining = entry.amountMg * Math.pow(0.5, elapsedHours / CAFFEINE_HALF_LIFE_HOURS);
    total += remaining;
  }

  return Math.round(total * 10) / 10;
}

export function calculateCaffeineTimeline(
  entries: CaffeineEntry[]
): { hour: number; level: number }[] {
  if (entries.length === 0) return [];

  // Find earliest entry timestamp
  const earliestTs = Math.min(...entries.map((e) => e.timestamp));
  const startTime = new Date(earliestTs);
  // Set to the start of that hour
  startTime.setMinutes(0, 0, 0);

  const timeline: { hour: number; level: number }[] = [];
  const totalPoints = 49; // 24 hours * 2 points per hour + 1

  for (let i = 0; i < totalPoints; i++) {
    const pointTime = new Date(startTime.getTime() + i * 30 * 60 * 1000);
    const level = calculateCaffeineLevel(entries, pointTime);
    timeline.push({
      hour: Math.round((i * 0.5) * 100) / 100,
      level: Math.round(level * 10) / 10,
    });
  }

  return timeline;
}

export function calculateSleepDebt(
  records: SleepRecord[],
  recommendedHours: number
): SleepDebtResult {
  const today = new Date();
  const last7Days: { day: string; dayLabel: string; hours: number; debt: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr =
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0');
    const dayLabel = DAY_LABELS[date.getDay()];

    // Find record for this day
    const record = records.find((r) => r.date === dateStr);
    const hours = record ? record.hoursSlept : 0;
    const debt = Math.max(0, recommendedHours - hours);

    last7Days.push({ day: dateStr, dayLabel, hours, debt });
  }

  const totalDebt = last7Days.reduce((sum, d) => sum + d.debt, 0);
  const daysWithRecords = last7Days.filter((d) => d.hours > 0);
  const avgHours =
    daysWithRecords.length > 0
      ? Math.round(
          (daysWithRecords.reduce((sum, d) => sum + d.hours, 0) / daysWithRecords.length) * 100
        ) / 100
      : 0;

  return {
    daily: last7Days,
    totalDebt: Math.round(totalDebt * 100) / 100,
    avgHours,
  };
}

export function generateSleepTips(
  stats: SleepStats,
  caffeineEntries: CaffeineEntry[]
): SleepTip[] {
  const tips: SleepTip[] = [];

  // High caffeine warning
  if (stats.currentCaffeineMg > 200) {
    tips.push({
      icon: 'ri-cup-line',
      title: '카페인 주의',
      description: `현재 체내 카페인이 ${Math.round(stats.currentCaffeineMg)}mg으로 높습니다. 취침 6시간 전부터는 카페인 섭취를 피하세요.`,
    });
  } else if (stats.currentCaffeineMg > 100) {
    tips.push({
      icon: 'ri-cup-line',
      title: '카페인 잔여량 확인',
      description: `체내 카페인이 약 ${Math.round(stats.currentCaffeineMg)}mg 남아있습니다. 취침 전까지 충분히 분해될 수 있도록 추가 섭취를 자제하세요.`,
    });
  }

  // Sleep debt warning
  if (stats.totalDebtHours > 10) {
    tips.push({
      icon: 'ri-error-warning-line',
      title: '심각한 수면 부족',
      description: `이번 주 수면 부채가 ${Math.round(stats.totalDebtHours)}시간입니다. 주말에 한번에 몰아자는 것보다 매일 30분씩 일찍 잠드는 것이 효과적입니다.`,
    });
  } else if (stats.totalDebtHours > 5) {
    tips.push({
      icon: 'ri-alarm-warning-line',
      title: '수면 부족 누적',
      description: `이번 주 수면 부채가 ${Math.round(stats.totalDebtHours)}시간입니다. 오늘 30분 일찍 잠자리에 들어보세요.`,
    });
  }

  // Short sleep warning
  if (stats.avgHoursThisWeek > 0 && stats.avgHoursThisWeek < 6) {
    tips.push({
      icon: 'ri-moon-foggy-line',
      title: '수면 시간 부족',
      description: `이번 주 평균 수면 시간이 ${stats.avgHoursThisWeek.toFixed(1)}시간입니다. 성인 기준 최소 7시간의 수면이 권장됩니다.`,
    });
  }

  // Variable bedtime (check if avgBedtime indicates irregularity)
  if (stats.totalRecords >= 3) {
    tips.push({
      icon: 'ri-time-line',
      title: '규칙적 취침 시간',
      description: '매일 같은 시간에 잠드는 습관이 수면의 질을 크게 향상시킵니다. 주말에도 30분 이내의 차이를 유지하세요.',
    });
  }

  // Late caffeine intake
  const now = new Date();
  const eveningEntries = caffeineEntries.filter((entry) => {
    const entryDate = new Date(entry.timestamp);
    const entryHour = entryDate.getHours();
    // Same day and after 4 PM
    return (
      entryDate.toDateString() === now.toDateString() && entryHour >= 16
    );
  });
  if (eveningEntries.length > 0) {
    tips.push({
      icon: 'ri-forbid-line',
      title: '늦은 카페인 섭취',
      description: '오후 4시 이후의 카페인 섭취는 수면의 질을 떨어뜨릴 수 있습니다. 디카페인이나 허브티로 대체해 보세요.',
    });
  }

  // General sleep hygiene tips (always included to reach 6-8 tips)
  tips.push({
    icon: 'ri-smartphone-line',
    title: '블루라이트 차단',
    description: '취침 1시간 전부터 스마트폰, 태블릿 등 전자기기 사용을 줄이세요. 블루라이트가 멜라토닌 분비를 억제합니다.',
  });

  tips.push({
    icon: 'ri-temp-cold-line',
    title: '적절한 실내 온도',
    description: '수면에 이상적인 실내 온도는 18-20도입니다. 너무 덥거나 추운 환경은 깊은 수면을 방해합니다.',
  });

  if (stats.longestSleep - stats.shortestSleep > 3 && stats.shortestSleep > 0) {
    tips.push({
      icon: 'ri-bar-chart-line',
      title: '수면 편차 큼',
      description: `가장 긴 수면(${stats.longestSleep.toFixed(1)}시간)과 짧은 수면(${stats.shortestSleep.toFixed(1)}시간)의 차이가 큽니다. 일정한 수면 패턴이 건강에 좋습니다.`,
    });
  }

  tips.push({
    icon: 'ri-run-line',
    title: '규칙적 운동',
    description: '규칙적인 운동은 수면의 질을 높여줍니다. 다만 취침 2-3시간 전에는 격한 운동을 피하세요.',
  });

  tips.push({
    icon: 'ri-restaurant-line',
    title: '취침 전 식사 주의',
    description: '취침 2-3시간 전에는 과식을 피하세요. 가벼운 간식은 괜찮지만, 무거운 식사는 수면을 방해합니다.',
  });

  // Return 6-8 tips
  return tips.slice(0, 8);
}

// ─────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error(`Failed to save to localStorage key: ${key}`);
  }
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useSleepState() {
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>(() =>
    loadFromStorage<SleepRecord[]>(STORAGE_KEYS.RECORDS, [])
  );

  const [caffeineEntries, setCaffeineEntries] = useState<CaffeineEntry[]>(() =>
    loadFromStorage<CaffeineEntry[]>(STORAGE_KEYS.CAFFEINE, [])
  );

  const [recommendedHours, setRecommendedHoursState] = useState<number>(() =>
    loadFromStorage<number>(STORAGE_KEYS.RECOMMENDED, DEFAULT_RECOMMENDED_HOURS)
  );

  // Persist sleep records
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RECORDS, sleepRecords);
  }, [sleepRecords]);

  // Persist caffeine entries
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CAFFEINE, caffeineEntries);
  }, [caffeineEntries]);

  // Persist recommended hours
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RECOMMENDED, recommendedHours);
  }, [recommendedHours]);

  // Add a sleep record (auto-calculates hoursSlept)
  const addSleepRecord = useCallback(
    (record: Omit<SleepRecord, 'id' | 'hoursSlept'>) => {
      const hoursSlept = calculateHoursSlept(record.bedtime, record.wakeTime);
      const newRecord: SleepRecord = {
        ...record,
        id: nanoid(),
        hoursSlept,
      };
      setSleepRecords((prev) => [...prev, newRecord]);
    },
    []
  );

  // Remove a sleep record by ID
  const removeSleepRecord = useCallback((id: string) => {
    setSleepRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Add a caffeine entry (auto-generates id and timestamp)
  const addCaffeineEntry = useCallback(
    (entry: Omit<CaffeineEntry, 'id' | 'timestamp'>) => {
      const newEntry: CaffeineEntry = {
        ...entry,
        id: nanoid(),
        timestamp: Date.now(),
      };
      setCaffeineEntries((prev) => [...prev, newEntry]);
    },
    []
  );

  // Remove a caffeine entry by ID
  const removeCaffeineEntry = useCallback((id: string) => {
    setCaffeineEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Clear all caffeine entries
  const clearCaffeineEntries = useCallback(() => {
    setCaffeineEntries([]);
  }, []);

  // Set recommended hours
  const setRecommendedHours = useCallback((hours: number) => {
    setRecommendedHoursState(Math.max(1, Math.min(24, hours)));
  }, []);

  // Computed stats
  const stats = useMemo<SleepStats>(() => {
    const now = new Date();
    const today = getTodayISO();

    // Records from the last 7 days
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoISO =
      sevenDaysAgo.getFullYear() +
      '-' +
      String(sevenDaysAgo.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(sevenDaysAgo.getDate()).padStart(2, '0');

    const weekRecords = sleepRecords.filter(
      (r) => r.date >= sevenDaysAgoISO && r.date <= today
    );

    const avgHoursThisWeek =
      weekRecords.length > 0
        ? Math.round(
            (weekRecords.reduce((sum, r) => sum + r.hoursSlept, 0) / weekRecords.length) * 100
          ) / 100
        : 0;

    const debtResult = calculateSleepDebt(sleepRecords, recommendedHours);

    const allHours = sleepRecords.map((r) => r.hoursSlept);
    const longestSleep = allHours.length > 0 ? Math.max(...allHours) : 0;
    const shortestSleep = allHours.length > 0 ? Math.min(...allHours) : 0;

    const avgBedtime =
      sleepRecords.length > 0
        ? averageTimeStr(sleepRecords.map((r) => r.bedtime))
        : '00:00';

    const avgWakeTime =
      sleepRecords.length > 0
        ? averageTimeStr(sleepRecords.map((r) => r.wakeTime))
        : '00:00';

    const currentCaffeineMg = calculateCaffeineLevel(caffeineEntries, now);

    return {
      totalRecords: sleepRecords.length,
      avgHoursThisWeek,
      totalDebtHours: debtResult.totalDebt,
      longestSleep,
      shortestSleep,
      avgBedtime,
      avgWakeTime,
      currentCaffeineMg,
    };
  }, [sleepRecords, caffeineEntries, recommendedHours]);

  return {
    sleepRecords,
    caffeineEntries,
    stats,
    recommendedHours,
    addSleepRecord,
    removeSleepRecord,
    addCaffeineEntry,
    removeCaffeineEntry,
    clearCaffeineEntries,
    setRecommendedHours,
  };
}
