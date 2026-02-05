import { useState } from 'react';
import { CaffeineEntry } from '../hooks/useSleepState';

interface CaffeineTrackerProps {
  entries: CaffeineEntry[];
  currentLevel: number;
  timeline: { hour: number; level: number }[];
  onAdd: (entry: Omit<CaffeineEntry, 'id' | 'timestamp'>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const QUICK_ADD_ITEMS: { type: CaffeineEntry['type']; label: string; amountMg: number; icon: string }[] = [
  { type: 'coffee', label: '커피', amountMg: 95, icon: 'ri-cup-line' },
  { type: 'espresso', label: '에스프레소', amountMg: 63, icon: 'ri-drop-line' },
  { type: 'tea', label: '녹차', amountMg: 30, icon: 'ri-leaf-line' },
  { type: 'energy', label: '에너지음료', amountMg: 80, icon: 'ri-flashlight-line' },
];

const TYPE_OPTIONS: { value: CaffeineEntry['type']; label: string }[] = [
  { value: 'coffee', label: '커피' },
  { value: 'espresso', label: '에스프레소' },
  { value: 'tea', label: '차' },
  { value: 'energy', label: '에너지음료' },
  { value: 'other', label: '기타' },
];

function getLevelStatus(mg: number): { label: string; className: string; icon: string } {
  if (mg < 50) {
    return { label: '수면 안전', className: 'level-safe', icon: 'ri-check-line' };
  }
  if (mg < 100) {
    return { label: '주의', className: 'level-caution', icon: 'ri-alert-line' };
  }
  return { label: '수면 영향', className: 'level-danger', icon: 'ri-error-warning-line' };
}

function getLevelColorClass(mg: number): string {
  if (mg < 50) return 'caffeine-green';
  if (mg < 100) return 'caffeine-yellow';
  return 'caffeine-red';
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTypeLabel(type: CaffeineEntry['type']): string {
  const map: Record<CaffeineEntry['type'], string> = {
    coffee: '커피',
    espresso: '에스프레소',
    tea: '차',
    energy: '에너지음료',
    other: '기타',
  };
  return map[type] ?? type;
}

export function CaffeineTracker({
  entries,
  currentLevel,
  timeline,
  onAdd,
  onRemove,
  onClear,
}: CaffeineTrackerProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customType, setCustomType] = useState<CaffeineEntry['type']>('coffee');
  const [customLabel, setCustomLabel] = useState('');

  const status = getLevelStatus(currentLevel);
  const levelColorClass = getLevelColorClass(currentLevel);

  const maxTimelineLevel = Math.max(
    ...timeline.map((t) => t.level),
    100,
    currentLevel
  );

  const handleQuickAdd = (item: typeof QUICK_ADD_ITEMS[number]) => {
    onAdd({
      amountMg: item.amountMg,
      type: item.type,
      label: item.label,
    });
  };

  const handleCustomAdd = () => {
    const amount = Number(customAmount);
    if (!amount || amount <= 0) return;

    onAdd({
      amountMg: amount,
      type: customType,
      label: customLabel.trim() || getTypeLabel(customType),
    });

    setCustomAmount('');
    setCustomLabel('');
    setShowCustomForm(false);
  };

  const handleClear = () => {
    if (entries.length === 0) return;
    onClear();
  };

  // Filter today's entries
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter((e) => e.timestamp >= todayStart.getTime());

  return (
    <div className="caffeine-tracker">
      {/* Current Level Display */}
      <div className="caffeine-level-display">
        <div className={`level-circle ${levelColorClass}`}>
          <span className="level-number">{Math.round(currentLevel)}</span>
          <span className="level-unit">mg</span>
        </div>
        <div className={`level-status ${status.className}`}>
          <i className={status.icon}></i>
          <span>{status.label}</span>
        </div>
        <p className="level-description">현재 체내 카페인 추정량</p>
      </div>

      {/* Quick Add Buttons */}
      <div className="quick-add-section">
        <h4 className="section-title">
          <i className="ri-add-circle-line"></i>
          빠른 추가
        </h4>
        <div className="quick-add-grid">
          {QUICK_ADD_ITEMS.map((item) => (
            <button
              key={item.type}
              className="quick-add-btn"
              onClick={() => handleQuickAdd(item)}
            >
              <i className={item.icon}></i>
              <span className="quick-add-label">{item.label}</span>
              <span className="quick-add-mg">{item.amountMg}mg</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Add */}
      <div className="custom-add-section">
        {!showCustomForm ? (
          <button
            className="custom-add-toggle"
            onClick={() => setShowCustomForm(true)}
          >
            <i className="ri-edit-line"></i>
            직접 입력하기
          </button>
        ) : (
          <div className="custom-add-form">
            <h4 className="section-title">직접 입력</h4>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">카페인 양 (mg)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 150"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="1"
                  max="1000"
                />
              </div>
              <div className="form-field">
                <label className="form-label">종류</label>
                <select
                  className="form-select"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as CaffeineEntry['type'])}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">메모 (선택)</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 아메리카노 벤티"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="form-actions">
              <button
                className="form-btn cancel-btn"
                onClick={() => setShowCustomForm(false)}
              >
                취소
              </button>
              <button
                className="form-btn confirm-btn"
                onClick={handleCustomAdd}
                disabled={!customAmount || Number(customAmount) <= 0}
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Caffeine Timeline Chart */}
      {timeline.length > 0 && (
        <div className="timeline-section">
          <h4 className="section-title">
            <i className="ri-line-chart-line"></i>
            카페인 분해 예측 (12시간)
          </h4>
          <div className="timeline-chart">
            <div className="chart-safe-line" style={{ bottom: `${(50 / maxTimelineLevel) * 100}%` }}>
              <span className="safe-line-label">50mg 안전선</span>
            </div>
            <div className="chart-bars">
              {timeline.slice(0, 12).map((point, index) => {
                const heightPercent = maxTimelineLevel > 0
                  ? (point.level / maxTimelineLevel) * 100
                  : 0;
                const barColorClass = point.level >= 100
                  ? 'bar-danger'
                  : point.level >= 50
                    ? 'bar-caution'
                    : 'bar-safe';
                return (
                  <div key={index} className="chart-bar-wrapper">
                    <div
                      className={`chart-bar ${barColorClass}`}
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    >
                      <span className="bar-tooltip">{Math.round(point.level)}mg</span>
                    </div>
                    <span className="bar-label">+{point.hour}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Today's Intake Log */}
      <div className="intake-log-section">
        <h4 className="section-title">
          <i className="ri-list-check"></i>
          오늘 섭취 기록
        </h4>
        {todayEntries.length === 0 ? (
          <div className="empty-log">
            <i className="ri-cup-line"></i>
            <p>오늘 기록된 카페인이 없습니다</p>
          </div>
        ) : (
          <div className="intake-list">
            {todayEntries
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((entry) => (
                <div key={entry.id} className="intake-item">
                  <div className="intake-info">
                    <span className="intake-label">{entry.label}</span>
                    <span className="intake-meta">
                      {formatTimestamp(entry.timestamp)} &middot; {entry.amountMg}mg
                    </span>
                  </div>
                  <button
                    className="intake-remove-btn"
                    onClick={() => onRemove(entry.id)}
                    aria-label="삭제"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Clear All */}
      {entries.length > 0 && (
        <button className="clear-all-btn" onClick={handleClear}>
          <i className="ri-delete-bin-line"></i>
          전체 초기화
        </button>
      )}
    </div>
  );
}
