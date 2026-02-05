import { useMemo } from 'react';
import { SleepStats, SleepRecord, CaffeineEntry, SleepTip } from '../hooks/useSleepState';

interface SleepAnalyticsProps {
  stats: SleepStats;
  records: SleepRecord[];
  caffeineEntries: CaffeineEntry[];
  tips: SleepTip[];
  unlocked: boolean;
  onUnlock: () => void;
}

function calculateSleepScore(stats: SleepStats, records: SleepRecord[]): number {
  if (records.length === 0) return 0;

  // Duration score (0-40): how close average is to 7.5h
  const idealHours = 7.5;
  const hoursDiff = Math.abs(stats.avgHoursThisWeek - idealHours);
  const durationScore = Math.max(0, 40 - hoursDiff * 10);

  // Debt score (0-30): less debt = higher score
  const debtPenalty = Math.min(stats.totalDebtHours * 3, 30);
  const debtScore = Math.max(0, 30 - debtPenalty);

  // Consistency score (0-30): standard deviation of sleep hours
  const hours = records.slice(-7).map((r) => r.hoursSlept);
  if (hours.length < 2) {
    return Math.round(Math.min(durationScore + debtScore + 15, 100));
  }
  const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
  const variance = hours.reduce((sum, h) => sum + (h - mean) ** 2, 0) / hours.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = Math.max(0, 30 - stdDev * 10);

  return Math.round(Math.min(durationScore + debtScore + consistencyScore, 100));
}

function getScoreGrade(score: number): { label: string; className: string } {
  if (score >= 80) return { label: '우수', className: 'score-great' };
  if (score >= 60) return { label: '양호', className: 'score-good' };
  if (score >= 40) return { label: '보통', className: 'score-fair' };
  return { label: '개선 필요', className: 'score-poor' };
}

function getWeeklyTrend(records: SleepRecord[]): { direction: 'up' | 'down' | 'stable'; label: string } {
  const recent = records.slice(-7);
  if (recent.length < 3) return { direction: 'stable', label: '데이터 부족' };

  const midpoint = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, midpoint);
  const secondHalf = recent.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, r) => sum + r.hoursSlept, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, r) => sum + r.hoursSlept, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  if (diff > 0.3) return { direction: 'up', label: '수면 시간 증가 추세' };
  if (diff < -0.3) return { direction: 'down', label: '수면 시간 감소 추세' };
  return { direction: 'stable', label: '안정적인 수면 패턴' };
}

function formatCaffeineImpact(currentMg: number, entries: CaffeineEntry[]): string {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter((e) => e.timestamp >= todayStart.getTime());
  const totalToday = todayEntries.reduce((sum, e) => sum + e.amountMg, 0);

  if (totalToday === 0) return '오늘 카페인 섭취 없음';
  if (currentMg < 50) return `오늘 ${totalToday}mg 섭취, 현재 안전 수준`;
  if (currentMg < 100) return `오늘 ${totalToday}mg 섭취, 수면에 약간의 영향 가능`;
  return `오늘 ${totalToday}mg 섭취, 수면에 영향을 줄 수 있음`;
}

function generateIdealSchedule(stats: SleepStats): { bedtime: string; wakeTime: string } {
  // Default ideal: based on average if available, otherwise 23:00-07:00
  if (stats.totalRecords === 0) {
    return { bedtime: '23:00', wakeTime: '07:00' };
  }
  return {
    bedtime: stats.avgBedtime || '23:00',
    wakeTime: stats.avgWakeTime || '07:00',
  };
}

export function SleepAnalytics({
  stats,
  records,
  caffeineEntries,
  tips,
  unlocked,
  onUnlock,
}: SleepAnalyticsProps) {
  const sleepScore = useMemo(() => calculateSleepScore(stats, records), [stats, records]);
  const scoreGrade = getScoreGrade(sleepScore);
  const weeklyTrend = useMemo(() => getWeeklyTrend(records), [records]);
  const caffeineImpact = useMemo(
    () => formatCaffeineImpact(stats.currentCaffeineMg, caffeineEntries),
    [stats.currentCaffeineMg, caffeineEntries]
  );
  const idealSchedule = useMemo(() => generateIdealSchedule(stats), [stats]);

  const trendIcon = weeklyTrend.direction === 'up'
    ? 'ri-arrow-up-line'
    : weeklyTrend.direction === 'down'
      ? 'ri-arrow-down-line'
      : 'ri-subtract-line';

  const firstTip = tips.length > 0 ? tips[0] : null;
  const remainingTips = tips.length > 1 ? tips.slice(1) : [];

  return (
    <div className="sleep-analytics">
      {/* FREE: Stat Cards */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <i className="ri-file-list-line stat-card-icon"></i>
          <span className="stat-card-value">{stats.totalRecords}</span>
          <span className="stat-card-label">총 기록</span>
        </div>
        <div className="stat-card">
          <i className="ri-moon-line stat-card-icon"></i>
          <span className="stat-card-value">
            {stats.avgHoursThisWeek > 0 ? stats.avgHoursThisWeek.toFixed(1) : '-'}
          </span>
          <span className="stat-card-label">평균 수면 (시간)</span>
        </div>
        <div className="stat-card">
          <i className="ri-time-line stat-card-icon"></i>
          <span className="stat-card-value">
            {stats.totalDebtHours > 0 ? stats.totalDebtHours.toFixed(1) : '0'}
          </span>
          <span className="stat-card-label">수면 부채 (시간)</span>
        </div>
        <div className="stat-card">
          <i className="ri-cup-line stat-card-icon"></i>
          <span className="stat-card-value">
            {Math.round(stats.currentCaffeineMg)}
          </span>
          <span className="stat-card-label">현재 카페인 (mg)</span>
        </div>
      </div>

      {/* FREE: Average Bedtime/Wake Time */}
      <div className="avg-times-section">
        <div className="avg-time-card">
          <i className="ri-moon-foggy-line"></i>
          <div className="avg-time-info">
            <span className="avg-time-label">평균 취침</span>
            <span className="avg-time-value">{stats.avgBedtime || '--:--'}</span>
          </div>
        </div>
        <div className="avg-time-card">
          <i className="ri-sun-foggy-line"></i>
          <div className="avg-time-info">
            <span className="avg-time-label">평균 기상</span>
            <span className="avg-time-value">{stats.avgWakeTime || '--:--'}</span>
          </div>
        </div>
      </div>

      {/* FREE: First Tip Preview */}
      {firstTip && (
        <div className="tip-preview-section">
          <h4 className="section-title">
            <i className="ri-lightbulb-line"></i>
            수면 팁
          </h4>
          <div className="tip-card">
            <i className={firstTip.icon}></i>
            <div className="tip-content">
              <span className="tip-title">{firstTip.title}</span>
              <p className="tip-description">{firstTip.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Locked Section */}
      {!unlocked && (
        <div className="locked-section">
          {/* Blurred preview */}
          <div className="locked-preview">
            <div className="locked-blur-overlay">
              {/* Fake blurred content for visual effect */}
              <div className="blurred-content">
                <div className="blurred-score-circle">
                  <span>--</span>
                </div>
                <div className="blurred-tips">
                  {remainingTips.slice(0, 3).map((_, i) => (
                    <div key={i} className="blurred-tip-placeholder"></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="locked-overlay-content">
              <i className="ri-lock-line locked-icon"></i>
              <p className="locked-text">맞춤 수면 분석이 준비되었어요</p>
              <button className="unlock-btn" onClick={onUnlock}>
                <i className="ri-lock-unlock-line"></i>
                수면 분석 보기
                <span className="ad-badge">AD</span>
              </button>
              <p className="ad-notice">광고 시청 후 맞춤 수면 분석을 확인할 수 있어요</p>
            </div>
          </div>
        </div>
      )}

      {/* Unlocked Premium Content */}
      {unlocked && (
        <div className="premium-section">
          {/* Sleep Score */}
          <div className="sleep-score-section">
            <h4 className="section-title">
              <i className="ri-award-line"></i>
              수면 점수
            </h4>
            <div className={`score-display ${scoreGrade.className}`}>
              <div className="score-circle">
                <span className="score-number">{sleepScore}</span>
                <span className="score-max">/100</span>
              </div>
              <span className="score-grade">{scoreGrade.label}</span>
            </div>
            <div className="score-breakdown">
              <p className="score-detail">
                수면 시간, 수면 부채, 수면 규칙성을 기반으로 산출됩니다
              </p>
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="trend-section">
            <h4 className="section-title">
              <i className="ri-line-chart-line"></i>
              주간 수면 추세
            </h4>
            <div className={`trend-card trend-${weeklyTrend.direction}`}>
              <i className={trendIcon}></i>
              <span className="trend-label">{weeklyTrend.label}</span>
            </div>
            {records.length >= 3 && (
              <div className="trend-details">
                <div className="trend-stat">
                  <span className="trend-stat-label">최장 수면</span>
                  <span className="trend-stat-value">{stats.longestSleep.toFixed(1)}시간</span>
                </div>
                <div className="trend-stat">
                  <span className="trend-stat-label">최단 수면</span>
                  <span className="trend-stat-value">{stats.shortestSleep.toFixed(1)}시간</span>
                </div>
              </div>
            )}
          </div>

          {/* Full Tips List */}
          {tips.length > 0 && (
            <div className="full-tips-section">
              <h4 className="section-title">
                <i className="ri-lightbulb-flash-line"></i>
                맞춤 수면 조언
              </h4>
              <div className="tips-list">
                {tips.map((tip, index) => (
                  <div key={index} className="tip-card">
                    <i className={tip.icon}></i>
                    <div className="tip-content">
                      <span className="tip-title">{tip.title}</span>
                      <p className="tip-description">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caffeine Impact */}
          <div className="caffeine-impact-section">
            <h4 className="section-title">
              <i className="ri-cup-line"></i>
              카페인 영향
            </h4>
            <div className="impact-card">
              <p className="impact-text">{caffeineImpact}</p>
            </div>
          </div>

          {/* Ideal Schedule */}
          <div className="ideal-schedule-section">
            <h4 className="section-title">
              <i className="ri-calendar-check-line"></i>
              이상적 수면 일정
            </h4>
            <div className="schedule-card">
              <div className="schedule-item">
                <i className="ri-moon-line"></i>
                <div className="schedule-info">
                  <span className="schedule-label">추천 취침</span>
                  <span className="schedule-time">{idealSchedule.bedtime}</span>
                </div>
              </div>
              <div className="schedule-divider">
                <i className="ri-arrow-right-line"></i>
              </div>
              <div className="schedule-item">
                <i className="ri-sun-line"></i>
                <div className="schedule-info">
                  <span className="schedule-label">추천 기상</span>
                  <span className="schedule-time">{idealSchedule.wakeTime}</span>
                </div>
              </div>
            </div>
            <p className="schedule-note">
              기록된 데이터를 기반으로 가장 적합한 수면 스케줄을 추천합니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
