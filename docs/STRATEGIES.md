<!-- title: Strategies | category: User Guide -->

# Trading Strategies

Algo Trading V2 runs 4 uncorrelated strategies on Bybit perpetual futures. Each strategy has a fixed capital allocation and operates on specific timeframes and symbols.

## Strategy Overview

| Strategy | ID | Allocation | Timeframe | Max Leverage | Category |
|----------|-----|-----------|-----------|-------------|----------|
| Multi-Timeframe Trend Following | `trend_following` | 30% | Daily + 4H | 3x | Trend |
| Mean Reversion Scalper | `mean_reversion` | 20% | 15m + 1H | 2x | Mean Reversion |
| Funding Rate Carry | `funding_carry` | 20% | 1H + 8H | 2x | Carry |
| Cross-Sectional Momentum | `cross_momentum` | 30% | Daily (weekly rebalance) | 2x | Momentum |

Total allocation: 100% of portfolio capital.

---

## 1. Multi-Timeframe Trend Following

**Goal**: Capture medium-term trends using EMA crossovers confirmed by daily trend filters.

### Timeframes

- **Daily (1D)**: Trend filter — determines overall direction
- **4-Hour (4H)**: Entry/exit — precise timing within the daily trend

### Symbols

BTCUSDT, ETHUSDT, SOLUSDT, AVAXUSDT, LINKUSDT, DOTUSDT, ADAUSDT, NEARUSDT, INJUSDT, SUIUSDT, RENDERUSDT

### Indicators

| Timeframe | Indicator | Parameters |
|-----------|-----------|------------|
| Daily | EMA | Period: 50 |
| Daily | ADX | Period: 14 |
| 4H | EMA (fast) | Period: 9 |
| 4H | EMA (slow) | Period: 21 |
| 4H | ATR | Period: 14 |
| 4H | RSI | Period: 14 |
| 4H | Volume SMA | Period: 20 |

### Entry Rules

**Long Entry:**
- Daily: Price above EMA(50), ADX > 25 (trending)
- 4H: EMA(9) crosses above EMA(21)
- RSI > 40 and < 75 (not overbought)
- Volume above SMA(20)

**Short Entry:**
- Daily: Price below EMA(50), ADX > 25
- 4H: EMA(9) crosses below EMA(21)
- RSI < 60 and > 25 (not oversold)
- Volume above SMA(20)

### Exit Rules

- **Stop Loss**: 2x ATR(14) from entry price
- **Take Profit**: 3x ATR(14) from entry price
- **Trailing Stop**: 1.5x ATR(14), activated after 1x ATR in profit

---

## 2. Mean Reversion Scalper

**Goal**: Exploit short-term price extremes using Bollinger Bands and RSI/StochRSI.

### Timeframes

- **15-Minute (15m)**: Primary — entry/exit signals
- **1-Hour (1H)**: Filter — confirms broader context

### Symbols

BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, AVAXUSDT, BNBUSDT

### Indicators

| Timeframe | Indicator | Parameters |
|-----------|-----------|------------|
| 15m | Bollinger Bands | Period: 20, StdDev: 2.0 |
| 15m | RSI | Period: 7 |
| 15m | StochRSI | Period: 14, K: 3, D: 3 |
| 15m | Volume SMA | Period: 20 |
| 15m | ATR | Period: 14 |
| 1H | EMA | Period: 50 |

### Entry Rules

**Long Entry:**
- 15m: Price touches or crosses below lower Bollinger Band
- RSI(7) < 25 (oversold)
- StochRSI K crosses above D (bullish crossover)
- Volume spike (above SMA)

**Short Entry:**
- 15m: Price touches or crosses above upper Bollinger Band
- RSI(7) > 75 (overbought)
- StochRSI K crosses below D (bearish crossover)
- Volume spike

### Exit Rules

- **Stop Loss**: 1.5x ATR(14) from entry
- **Take Profit**: Middle Bollinger Band (partial 50%, trail remainder)
- **RSI Exit**: Close when RSI normalizes to 40–60 range
- **Time Stop**: Close after 12 candles (3 hours) if no TP/SL hit

---

## 3. Funding Rate Carry

**Goal**: Earn funding payments by taking positions opposite to extreme funding rates.

### Timeframes

- **1-Hour (1H)**: Execution and monitoring
- **8-Hour**: Funding rate settlement cycle

### Symbols

Dynamic — selected by universe scanner based on funding rate extremes. The scanner identifies the top symbols with the highest absolute funding rate Z-scores.

### Indicators

| Indicator | Parameters |
|-----------|------------|
| RSI | Period: 14 |
| ATR | Period: 14 |
| Funding Rate Z-Score | Rolling window |
| 7-Day Average Funding Rate | — |
| Open Interest Change | — |

### Entry Rules

**Short Entry** (collect positive funding):
- Funding rate Z-score > 1.5 (extremely positive)
- Position earns funding from longs paying shorts

**Long Entry** (collect negative funding):
- Funding rate Z-score < -1.5 (extremely negative)
- Position earns funding from shorts paying longs

### Exit Rules

- **Stop Loss**: 2.5x ATR(14) from entry
- **Funding Normalization**: Close when Z-score returns to -0.5 to +0.5 range
- **Time Stop**: Close after 3–5 funding periods (24–40 hours) if funding hasn't normalized

---

## 4. Cross-Sectional Momentum

**Goal**: Weekly rotation into the strongest momentum coins and out of the weakest.

### Timeframes

- **Daily (1D)**: Signal computation
- **Weekly**: Rebalance every Monday at 00:00 UTC

### Symbols

Dynamic — Top 30 coins by 14-day average volume (> $10M daily).

### Indicators

| Indicator | Parameters |
|-----------|------------|
| Rate of Change (ROC) | Periods: 7, 14, 30 days |
| Realized Volatility | 14-day rolling |
| ATR | Period: 14 |
| Drawdown from 30-day high | — |
| BTC EMA | Period: 50 |

### Entry Rules

**Long Basket**: Top 5 coins by volatility-adjusted momentum (ROC / Volatility)

**Short Basket**: Bottom 5 coins by volatility-adjusted momentum
- Skipped if BTC is above its 50-day EMA (bullish market regime favors long-only)

### Position Sizing

Equal volatility-weighted allocation. Each position sized based on ATR to equalize risk contribution.

### Rebalance Rules

- Rebalance every Monday at 00:00 UTC
- Close positions no longer in the basket
- Open new positions for new basket members
- Adjust sizes for continuing positions

---

## Strategy Management

### Viewing Strategies

Navigate to the **Strategies** tab to see all strategies with their current status, allocated capital, and recent signals.

### Pausing / Resuming

Each strategy can be individually paused or resumed from the Strategies tab. Pausing a strategy:
- Stops new signal generation
- Does NOT close existing positions
- Can be resumed at any time

### Configuration

Strategy parameters can be adjusted per trading account:
- Capital allocation percentage
- Maximum leverage
- Symbol universe
- Strategy-specific parameters (indicator periods, thresholds)

Changes are applied on the next candle cycle.

### Circuit Breakers

Strategies are automatically paused by circuit breakers when drawdown thresholds are exceeded. See [Risk Management](./RISK-MANAGEMENT.md) for details.
