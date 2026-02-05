import { useState, useMemo } from 'react';
import { calculateOptimalTimes, OptimalTime } from '../hooks/useSleepState';

const QUALITY_CONFIG: Record<OptimalTime['quality'], { label: string; className: string }> = {
  poor: { label: '부족', className: 'quality-poor' },
  fair: { label: '보통', className: 'quality-fair' },
  good: { label: '좋음', className: 'quality-good' },
  great: { label: '최적', className: 'quality-great' },
};

const SLEEP_FACTS = [
  { icon: 'ri-moon-line', text: '수면 주기 1회 = 약 90분' },
  { icon: 'ri-time-line', text: '잠들기까지 평균 약 15분 소요' },
  { icon: 'ri-heart-pulse-line', text: '성인 권장 수면 시간: 7~9시간' },
  { icon: 'ri-brain-line', text: '깊은 수면은 처음 3시간에 집중됩니다' },
];

function getCurrentTimePlus15(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getCurrentTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function SleepCalculator() {
  const [mode, setMode] = useState<'bedtime' | 'wakeup'>('wakeup');
  const [targetTime, setTargetTime] = useState<string>('07:00');
  const [results, setResults] = useState<OptimalTime[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);

  const modeLabel = mode === 'bedtime'
    ? '취침 시간 계산'
    : '기상 시간 계산';

  const inputLabel = mode === 'bedtime'
    ? '몇 시에 일어나야 하나요?'
    : '몇 시에 잠들 예정인가요?';

  const resultLabel = mode === 'bedtime'
    ? '추천 취침 시간'
    : '추천 기상 시간';

  const handleCalculate = () => {
    if (!targetTime) return;
    const optimal = calculateOptimalTimes(targetTime, mode);
    setResults(optimal);
    setHasCalculated(true);
  };

  const handleNowButton = () => {
    if (mode === 'wakeup') {
      setTargetTime(getCurrentTimePlus15());
    } else {
      setTargetTime(getCurrentTime());
    }
  };

  const bestQualityIndex = useMemo(() => {
    if (results.length === 0) return -1;
    const qualityOrder: Record<string, number> = { great: 4, good: 3, fair: 2, poor: 1 };
    let bestIdx = 0;
    let bestScore = 0;
    results.forEach((r, i) => {
      const score = qualityOrder[r.quality] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [results]);

  const formatHoursMinutes = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  };

  return (
    <div className="sleep-calculator">
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-toggle-btn ${mode === 'wakeup' ? 'active' : ''}`}
          onClick={() => {
            setMode('wakeup');
            setResults([]);
            setHasCalculated(false);
          }}
        >
          <i className="ri-sun-line"></i>
          기상 시간 계산
        </button>
        <button
          className={`mode-toggle-btn ${mode === 'bedtime' ? 'active' : ''}`}
          onClick={() => {
            setMode('bedtime');
            setResults([]);
            setHasCalculated(false);
          }}
        >
          <i className="ri-moon-line"></i>
          취침 시간 계산
        </button>
      </div>

      {/* Time Input */}
      <div className="time-input-section">
        <p className="input-label">{inputLabel}</p>
        <div className="time-input-wrapper">
          <input
            type="time"
            className="time-input"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
          />
        </div>
        <button className="now-btn" onClick={handleNowButton}>
          <i className="ri-flashlight-line"></i>
          {mode === 'wakeup' ? '지금 잠들면? (+15분)' : '지금 시간으로 설정'}
        </button>
      </div>

      {/* Calculate Button */}
      <button
        className="calculate-btn primary-btn"
        onClick={handleCalculate}
        disabled={!targetTime}
      >
        <i className="ri-calculator-line"></i>
        계산하기
      </button>

      {/* Results */}
      {hasCalculated && results.length > 0 && (
        <div className="results-section">
          <h3 className="results-title">
            <i className="ri-star-line"></i>
            {resultLabel}
          </h3>
          <div className="results-list">
            {results.map((result, index) => {
              const config = QUALITY_CONFIG[result.quality];
              const isBest = index === bestQualityIndex;
              return (
                <div
                  key={`${result.time}-${index}`}
                  className={`result-card ${isBest ? 'result-card-best' : ''}`}
                >
                  {isBest && (
                    <span className="best-badge">
                      <i className="ri-thumb-up-line"></i> 추천
                    </span>
                  )}
                  <div className="result-card-main">
                    <span className="result-time">{result.time}</span>
                    <span className={`quality-badge ${config.className}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="result-detail">
                    {result.cycles}회 수면 주기 &middot; {formatHoursMinutes(result.hours)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasCalculated && results.length === 0 && (
        <div className="empty-results">
          <i className="ri-error-warning-line"></i>
          <p>계산 결과가 없습니다. 시간을 확인해주세요.</p>
        </div>
      )}

      {/* Sleep Facts */}
      <div className="sleep-facts">
        <h4 className="facts-title">
          <i className="ri-lightbulb-line"></i>
          수면 상식
        </h4>
        <div className="facts-list">
          {SLEEP_FACTS.map((fact, index) => (
            <div key={index} className="fact-item">
              <i className={fact.icon}></i>
              <span>{fact.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
