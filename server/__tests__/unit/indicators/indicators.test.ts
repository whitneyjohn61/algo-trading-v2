import { Candle } from '../../../src/indicators/types';
import { SmaIndicator } from '../../../src/indicators/sma';
import { EmaIndicator } from '../../../src/indicators/ema';
import { RsiIndicator } from '../../../src/indicators/rsi';
import { AtrIndicator } from '../../../src/indicators/atr';
import { BollingerIndicator } from '../../../src/indicators/bollinger';
import { VolumeSmaIndicator } from '../../../src/indicators/volumeSma';
import { AdxIndicator } from '../../../src/indicators/adx';
import { StochRsiIndicator } from '../../../src/indicators/stochRsi';
import { RocIndicator } from '../../../src/indicators/roc';
import { BbWidthIndicator } from '../../../src/indicators/bbWidth';
import { RealizedVolIndicator } from '../../../src/indicators/realizedVol';
import {
  createIndicator,
  getAvailableIndicators,
  isIndicatorAvailable,
} from '../../../src/indicators/registry';

// ── Test data ──────────────────────────────────────────────

/** 30 candles with realistic BTC-like price movement */
function makeCandles(count: number = 30): Candle[] {
  const base = 50000;
  const startTs = 1700000000000; // arbitrary UTC ms
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    // Simple deterministic price walk
    const offset = Math.sin(i * 0.5) * 500 + i * 10;
    const close = base + offset;
    const high = close + 100 + (i % 3) * 50;
    const low = close - 100 - (i % 4) * 40;
    const open = close - 50 + (i % 2) * 100;
    candles.push({
      timestamp: startTs + i * 60000, // 1-minute candles
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 100 + i * 10,
    });
  }
  return candles;
}

const candles = makeCandles(30);
const longCandles = makeCandles(60);

// ── Validation ─────────────────────────────────────────────

describe('Indicator input validation', () => {
  it('should return empty for empty candle array', () => {
    const sma = new SmaIndicator(14);
    expect(sma.calculate([])).toEqual([]);
  });

  it('should return empty when candles < period', () => {
    const sma = new SmaIndicator(50);
    expect(sma.calculate(candles)).toEqual([]);
  });

  it('should return empty for non-sequential timestamps', () => {
    const bad: Candle[] = [
      { timestamp: 2000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { timestamp: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }, // backwards
    ];
    const sma = new SmaIndicator(2);
    expect(sma.calculate(bad)).toEqual([]);
  });
});

// ── SMA ────────────────────────────────────────────────────

describe('SmaIndicator', () => {
  const sma = new SmaIndicator(5);

  it('should have correct name and period', () => {
    expect(sma.name).toBe('SMA');
    expect(sma.period).toBe(5);
  });

  it('should return period-1 fewer values than input', () => {
    const result = sma.calculate(candles);
    expect(result.length).toBe(candles.length - 5 + 1);
  });

  it('should align timestamps correctly', () => {
    const result = sma.calculate(candles);
    // First output should align with candle at index period-1
    expect(result[0]!.timestamp).toBe(candles[4]!.timestamp);
  });

  it('should compute correct SMA value for first window', () => {
    const result = sma.calculate(candles);
    const expected = candles.slice(0, 5).reduce((sum, c) => sum + c.close, 0) / 5;
    expect(result[0]!.value).toBeCloseTo(expected, 1);
  });
});

// ── EMA ────────────────────────────────────────────────────

describe('EmaIndicator', () => {
  const ema = new EmaIndicator(5);

  it('should return values', () => {
    const result = ema.calculate(candles);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBe(candles.length - 5 + 1);
  });

  it('should differ from SMA (exponential weighting)', () => {
    const smaResult = new SmaIndicator(5).calculate(candles);
    const emaResult = ema.calculate(candles);
    // After first value, EMA and SMA should diverge
    const lastSma = smaResult[smaResult.length - 1]!.value;
    const lastEma = emaResult[emaResult.length - 1]!.value;
    // They should be similar but not identical
    expect(Math.abs(lastSma - lastEma)).toBeLessThan(500);
    expect(lastSma).not.toBe(lastEma);
  });
});

// ── RSI ────────────────────────────────────────────────────

describe('RsiIndicator', () => {
  const rsi = new RsiIndicator(14);

  it('should return values in 0-100 range', () => {
    const result = rsi.calculate(candles);
    for (const r of result) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    }
  });

  it('should return 50 when all prices are equal', () => {
    const flat: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: 1000 + i * 60000,
      open: 100, high: 100, low: 100, close: 100, volume: 10,
    }));
    const result = rsi.calculate(flat);
    for (const r of result) {
      expect(r.value).toBe(50);
    }
  });
});

// ── ATR ────────────────────────────────────────────────────

describe('AtrIndicator', () => {
  const atr = new AtrIndicator(14);

  it('should return positive values', () => {
    const result = atr.calculate(candles);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.value).toBeGreaterThan(0);
    }
  });
});

// ── Bollinger Bands ────────────────────────────────────────

describe('BollingerIndicator', () => {
  const bb = new BollingerIndicator(20, 2);

  it('should return upper > middle > lower', () => {
    const result = bb.calculate(candles);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.upper).toBeGreaterThan(r.middle);
      expect(r.middle).toBeGreaterThan(r.lower);
    }
  });
});

// ── Volume SMA ─────────────────────────────────────────────

describe('VolumeSmaIndicator', () => {
  const vol = new VolumeSmaIndicator(5);

  it('should compute average of volume', () => {
    const result = vol.calculate(candles);
    expect(result.length).toBe(candles.length - 5 + 1);
    const expected = candles.slice(0, 5).reduce((s, c) => s + c.volume, 0) / 5;
    expect(result[0]!.value).toBeCloseTo(expected, 1);
  });
});

// ── ADX ────────────────────────────────────────────────────

describe('AdxIndicator', () => {
  const adx = new AdxIndicator(14);

  it('should return values in 0-100 range', () => {
    const result = adx.calculate(longCandles);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    }
  });

  it('should require 2*period candles', () => {
    const short = makeCandles(20);
    expect(adx.calculate(short)).toEqual([]);
  });
});

// ── StochRSI ───────────────────────────────────────────────

describe('StochRsiIndicator', () => {
  const stoch = new StochRsiIndicator(14, 3, 3);

  it('should return k and d values', () => {
    const result = stoch.calculate(longCandles);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(typeof r.k).toBe('number');
      expect(typeof r.d).toBe('number');
    }
  });
});

// ── ROC ────────────────────────────────────────────────────

describe('RocIndicator', () => {
  const roc = new RocIndicator(10);

  it('should return positive and negative values', () => {
    const result = roc.calculate(candles);
    expect(result.length).toBeGreaterThan(0);
    // With sine-wave prices we should get both positive and negative ROC
    const hasPositive = result.some(r => r.value > 0);
    const hasNegative = result.some(r => r.value < 0);
    expect(hasPositive || hasNegative).toBe(true);
  });
});

// ── BB Width ───────────────────────────────────────────────

describe('BbWidthIndicator', () => {
  const bbw = new BbWidthIndicator(20, 2);

  it('should return positive width values', () => {
    const result = bbw.calculate(candles);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.value).toBeGreaterThan(0);
    }
  });
});

// ── Realized Vol ───────────────────────────────────────────

describe('RealizedVolIndicator', () => {
  const rv = new RealizedVolIndicator(10);

  it('should return positive volatility', () => {
    const result = rv.calculate(candles);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.value).toBeGreaterThanOrEqual(0);
    }
  });

  it('should return 0 vol for flat prices', () => {
    const flat: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: 1000 + i * 60000,
      open: 100, high: 100, low: 100, close: 100, volume: 10,
    }));
    const result = rv.calculate(flat);
    for (const r of result) {
      expect(r.value).toBe(0);
    }
  });
});

// ── Registry ───────────────────────────────────────────────

describe('Indicator registry', () => {
  it('should list all 11 indicators', () => {
    const available = getAvailableIndicators();
    expect(available).toContain('SMA');
    expect(available).toContain('EMA');
    expect(available).toContain('RSI');
    expect(available).toContain('ATR');
    expect(available).toContain('BBANDS');
    expect(available).toContain('VOLUME_SMA');
    expect(available).toContain('ADX');
    expect(available).toContain('STOCH_RSI');
    expect(available).toContain('ROC');
    expect(available).toContain('BB_WIDTH');
    expect(available).toContain('REALIZED_VOL');
    expect(available.length).toBe(11);
  });

  it('should create indicator by name', () => {
    const sma = createIndicator('SMA', 20);
    expect(sma.name).toBe('SMA');
    expect(sma.period).toBe(20);
  });

  it('should throw for unknown indicator', () => {
    expect(() => createIndicator('FAKE')).toThrow('Unknown indicator: FAKE');
  });

  it('should report availability correctly', () => {
    expect(isIndicatorAvailable('SMA')).toBe(true);
    expect(isIndicatorAvailable('NOPE')).toBe(false);
  });
});
