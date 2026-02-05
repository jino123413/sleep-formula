import { useState, useCallback, useMemo, useEffect } from 'react';
import { useInterstitialAd } from './hooks/useInterstitialAd';
import {
  useSleepState,
  calculateCaffeineLevel,
  calculateCaffeineTimeline,
  calculateSleepDebt,
  generateSleepTips,
  getTodayISO,
} from './hooks/useSleepState';
import { SleepCalculator } from './components/SleepCalculator';
import { CaffeineTracker } from './components/CaffeineTracker';
import { SleepDebt } from './components/SleepDebt';
import { SleepAnalytics } from './components/SleepAnalytics';

type TabId = 'sleep' | 'caffeine' | 'debt' | 'analytics';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'sleep', label: '수면 계산', icon: 'ri-moon-line' },
  { id: 'caffeine', label: '카페인', icon: 'ri-cup-line' },
  { id: 'debt', label: '수면 기록', icon: 'ri-calendar-check-line' },
  { id: 'analytics', label: '분석', icon: 'ri-bar-chart-grouped-line' },
];

const ANALYTICS_UNLOCK_KEY = 'sleep-formula-analytics-unlock';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('sleep');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Analytics unlock state (daily reset)
  const [analyticsUnlocked, setAnalyticsUnlocked] = useState(() => {
    try {
      const stored = localStorage.getItem(ANALYTICS_UNLOCK_KEY);
      if (stored === getTodayISO()) return true;
    } catch {}
    return false;
  });

  const { showInterstitialAd } = useInterstitialAd();

  const {
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
  } = useSleepState();

  // Computed data
  const currentCaffeineLevel = useMemo(
    () => calculateCaffeineLevel(caffeineEntries),
    [caffeineEntries]
  );

  const caffeineTimeline = useMemo(
    () => calculateCaffeineTimeline(caffeineEntries),
    [caffeineEntries]
  );

  const debtResult = useMemo(
    () => calculateSleepDebt(sleepRecords, recommendedHours),
    [sleepRecords, recommendedHours]
  );

  const sleepTips = useMemo(
    () => generateSleepTips(stats, caffeineEntries),
    [stats, caffeineEntries]
  );

  // Toast helper
  const showToast = useCallback((message: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastMessage(message);
    const timer = setTimeout(() => setToastMessage(null), 2500);
    setToastTimer(timer);
  }, [toastTimer]);

  useEffect(() => {
    return () => { if (toastTimer) clearTimeout(toastTimer); };
  }, [toastTimer]);

  // Ad handler for analytics unlock
  const handleUnlockAnalytics = useCallback(() => {
    showInterstitialAd({
      onDismiss: () => {
        setAnalyticsUnlocked(true);
        try {
          localStorage.setItem(ANALYTICS_UNLOCK_KEY, getTodayISO());
        } catch {}
        showToast('수면 분석이 잠금 해제되었어요!');
      },
      onUnavailable: () => {
        showToast('광고를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
      },
    });
  }, [showInterstitialAd, showToast]);

  const tabTitle = TABS.find(t => t.id === activeTab)?.label || '수면 공식';

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="header-title">수면 공식</h1>
        <p className="header-subtitle">{tabTitle}</p>
      </header>

      {/* Content */}
      <main className="app-content">
        {activeTab === 'sleep' && <SleepCalculator />}

        {activeTab === 'caffeine' && (
          <CaffeineTracker
            entries={caffeineEntries}
            currentLevel={currentCaffeineLevel}
            timeline={caffeineTimeline}
            onAdd={addCaffeineEntry}
            onRemove={removeCaffeineEntry}
            onClear={clearCaffeineEntries}
          />
        )}

        {activeTab === 'debt' && (
          <SleepDebt
            records={sleepRecords}
            recommendedHours={recommendedHours}
            debtResult={debtResult}
            onAddRecord={addSleepRecord}
            onRemoveRecord={removeSleepRecord}
            onSetRecommended={setRecommendedHours}
          />
        )}

        {activeTab === 'analytics' && (
          <SleepAnalytics
            stats={stats}
            records={sleepRecords}
            caffeineEntries={caffeineEntries}
            tips={sleepTips}
            unlocked={analyticsUnlocked}
            onUnlock={handleUnlockAnalytics}
          />
        )}
      </main>

      {/* Tab Bar */}
      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={tab.icon}></i>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Toast */}
      {toastMessage && (
        <div className="toast">{toastMessage}</div>
      )}
    </div>
  );
}

export default App;
