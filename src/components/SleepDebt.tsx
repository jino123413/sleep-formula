import { useState } from 'react';
import { SleepRecord, SleepDebtResult } from '../hooks/useSleepState';

interface SleepDebtProps {
  records: SleepRecord[];
  recommendedHours: number;
  debtResult: SleepDebtResult;
  onAddRecord: (record: Omit<SleepRecord, 'id' | 'hoursSlept'>) => void;
  onRemoveRecord: (id: string) => void;
  onSetRecommended: (hours: number) => void;
}

function getDebtColorClass(totalDebt: number): string {
  if (totalDebt > 5) return 'debt-high';
  if (totalDebt > 2) return 'debt-medium';
  return 'debt-low';
}

function getDebtStatusLabel(totalDebt: number): string {
  if (totalDebt > 5) return '심각한 수면 부채';
  if (totalDebt > 2) return '수면 부채 주의';
  if (totalDebt > 0) return '양호';
  return '충분한 수면';
}

function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[1]}/${parts[2]}`;
  } catch {
    return dateStr;
  }
}

export function SleepDebt({
  records,
  recommendedHours,
  debtResult,
  onAddRecord,
  onRemoveRecord,
  onSetRecommended,
}: SleepDebtProps) {
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [recordDate, setRecordDate] = useState(getTodayDateString());

  const { daily, totalDebt, avgHours } = debtResult;

  const debtColorClass = getDebtColorClass(totalDebt);
  const debtStatusLabel = getDebtStatusLabel(totalDebt);

  const maxChartHours = Math.max(
    recommendedHours + 2,
    ...daily.map((d) => d.hours),
    10
  );

  const handleAddRecord = () => {
    if (!bedtime || !wakeTime || !recordDate) return;
    onAddRecord({
      date: recordDate,
      bedtime,
      wakeTime,
    });
  };

  const handleRecommendedChange = (delta: number) => {
    const next = recommendedHours + delta;
    if (next >= 6 && next <= 10) {
      onSetRecommended(next);
    }
  };

  // Calculate recovery suggestion
  const recoverySuggestion = (() => {
    if (totalDebt <= 0) return null;
    const recoveryDays = 7;
    const extraMinutesPerDay = Math.ceil((totalDebt * 60) / recoveryDays);
    const extraH = Math.floor(extraMinutesPerDay / 60);
    const extraM = extraMinutesPerDay % 60;
    const extraStr = extraH > 0 ? `${extraH}시간 ${extraM}분` : `${extraM}분`;
    return `부족한 ${totalDebt.toFixed(1)}시간을 보충하려면 ${recoveryDays}일간 매일 ${extraStr} 더 주무세요`;
  })();

  // Recent records (last 7)
  const recentRecords = records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <div className="sleep-debt">
      {/* Recommended Hours Setting */}
      <div className="recommended-section">
        <h4 className="section-title">
          <i className="ri-settings-3-line"></i>
          권장 수면 시간
        </h4>
        <div className="recommended-control">
          <button
            className="adjust-btn"
            onClick={() => handleRecommendedChange(-0.5)}
            disabled={recommendedHours <= 6}
            aria-label="줄이기"
          >
            <i className="ri-subtract-line"></i>
          </button>
          <span className="recommended-value">
            {recommendedHours}시간
          </span>
          <button
            className="adjust-btn"
            onClick={() => handleRecommendedChange(0.5)}
            disabled={recommendedHours >= 10}
            aria-label="늘리기"
          >
            <i className="ri-add-line"></i>
          </button>
        </div>
      </div>

      {/* Sleep Debt Summary */}
      <div className="debt-summary">
        <div className={`debt-display ${debtColorClass}`}>
          <span className="debt-number">{totalDebt.toFixed(1)}</span>
          <span className="debt-unit">시간</span>
          <span className="debt-label">주간 수면 부채</span>
        </div>
        <div className="debt-status-row">
          <span className={`debt-status-badge ${debtColorClass}`}>
            {debtStatusLabel}
          </span>
          <span className="avg-hours-text">
            주간 평균: {avgHours.toFixed(1)}시간
          </span>
        </div>
      </div>

      {/* Weekly Bar Chart */}
      {daily.length > 0 && (
        <div className="weekly-chart-section">
          <h4 className="section-title">
            <i className="ri-bar-chart-2-line"></i>
            주간 수면 현황
          </h4>
          <div className="weekly-chart">
            <div
              className="chart-recommended-line"
              style={{ bottom: `${(recommendedHours / maxChartHours) * 100}%` }}
            >
              <span className="recommended-line-label">{recommendedHours}h 권장</span>
            </div>
            <div className="chart-columns">
              {daily.map((day) => {
                const actualPercent = maxChartHours > 0
                  ? (day.hours / maxChartHours) * 100
                  : 0;
                const recPercent = maxChartHours > 0
                  ? (recommendedHours / maxChartHours) * 100
                  : 0;
                const hasDebt = day.debt > 0;
                return (
                  <div key={day.day} className="chart-column">
                    <div className="column-bars">
                      <div
                        className="column-recommended-bg"
                        style={{ height: `${Math.min(recPercent, 100)}%` }}
                      ></div>
                      <div
                        className={`column-actual ${hasDebt ? 'column-debt' : 'column-surplus'}`}
                        style={{ height: `${Math.min(Math.max(actualPercent, 2), 100)}%` }}
                      >
                        <span className="column-hours-label">
                          {day.hours > 0 ? day.hours.toFixed(1) : '-'}
                        </span>
                      </div>
                    </div>
                    <span className="column-day-label">{day.dayLabel}</span>
                    {hasDebt && (
                      <span className="column-debt-label">-{day.debt.toFixed(1)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-dot legend-actual"></span>
              실제 수면
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-recommended"></span>
              권장 수면
            </span>
          </div>
        </div>
      )}

      {/* Recovery Suggestion */}
      {recoverySuggestion && (
        <div className="recovery-suggestion">
          <i className="ri-lightbulb-line"></i>
          <p>{recoverySuggestion}</p>
        </div>
      )}

      {/* Quick Add Today's Sleep */}
      <div className="add-record-section">
        <h4 className="section-title">
          <i className="ri-add-circle-line"></i>
          수면 기록하기
        </h4>
        <div className="add-record-form">
          <div className="form-field">
            <label className="form-label">날짜</label>
            <input
              type="date"
              className="form-input"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">취침 시간</label>
              <input
                type="time"
                className="form-input"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">기상 시간</label>
              <input
                type="time"
                className="form-input"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </div>
          </div>
          <button
            className="record-btn primary-btn"
            onClick={handleAddRecord}
            disabled={!bedtime || !wakeTime || !recordDate}
          >
            <i className="ri-save-line"></i>
            기록하기
          </button>
        </div>
      </div>

      {/* Recent Records */}
      <div className="recent-records-section">
        <h4 className="section-title">
          <i className="ri-history-line"></i>
          최근 기록
        </h4>
        {recentRecords.length === 0 ? (
          <div className="empty-records">
            <i className="ri-file-list-line"></i>
            <p>아직 기록이 없습니다</p>
          </div>
        ) : (
          <div className="records-list">
            {recentRecords.map((record) => (
              <div key={record.id} className="record-item">
                <div className="record-info">
                  <span className="record-date">{formatDateDisplay(record.date)}</span>
                  <span className="record-times">
                    {record.bedtime} ~ {record.wakeTime}
                  </span>
                  <span className={`record-hours ${record.hoursSlept < recommendedHours ? 'hours-deficit' : 'hours-ok'}`}>
                    {record.hoursSlept.toFixed(1)}시간
                  </span>
                </div>
                <button
                  className="record-remove-btn"
                  onClick={() => onRemoveRecord(record.id)}
                  aria-label="삭제"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
