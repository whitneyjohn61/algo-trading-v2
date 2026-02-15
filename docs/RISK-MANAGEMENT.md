<!-- title: Risk Management | category: User Guide -->

# Risk Management

Risk management is the most critical component of the trading system. It protects capital through circuit breakers, position sizing rules, and drawdown limits.

## Circuit Breakers

Circuit breakers are automatic safety mechanisms that halt trading when losses exceed predefined thresholds.

### Portfolio Circuit Breaker

| Parameter | Value | Description |
|-----------|-------|-------------|
| Drawdown Threshold | **25%** | Halt ALL strategies if portfolio drawdown exceeds this |
| Auto-Resume Threshold | **10%** | Auto-resume when drawdown recovers below this |
| Check Interval | 30 seconds | How often drawdown is evaluated |

**When triggered:**
1. All active strategies are immediately paused
2. No new orders are placed
3. Existing positions remain open (not auto-closed)
4. WebSocket alert sent to all connected clients
5. Slack notification sent (if configured)

**Recovery:**
- Automatic: When drawdown recovers below 10% (from position recoveries or manual closes)
- Manual: Admin can force-resume from the Portfolio dashboard

### Strategy Circuit Breaker

| Parameter | Value | Description |
|-----------|-------|-------------|
| Drawdown Threshold | **15%** | Pause individual strategy if its drawdown exceeds this |
| Auto-Resume Threshold | **10%** | Auto-resume when strategy drawdown recovers |

**When triggered:**
1. Only the affected strategy is paused
2. Other strategies continue operating
3. Strategy's existing positions remain open
4. Alert sent via WebSocket and notifications

### Circuit Breaker Status

View circuit breaker status on the Portfolio dashboard:
- **Active**: Normal operation
- **Triggered**: Trading halted, showing trigger reason and timestamp
- **Force Resumed**: Manually overridden by admin

## Position Sizing

### Capital Allocation

Each strategy operates within its allocated capital percentage:

| Strategy | Allocation | Example (on $50,000 portfolio) |
|----------|-----------|-------------------------------|
| Trend Following | 30% | $15,000 |
| Mean Reversion | 20% | $10,000 |
| Funding Carry | 20% | $10,000 |
| Cross Momentum | 30% | $15,000 |

### Leverage Limits

| Strategy | Max Leverage | Rationale |
|----------|-------------|-----------|
| Trend Following | 3x | Higher conviction, longer holds |
| Mean Reversion | 2x | Short-term, higher frequency |
| Funding Carry | 2x | Lower volatility plays |
| Cross Momentum | 2x | Diversified basket reduces risk |

### Position Size Calculation

```
Position Size = (Allocated Capital × Leverage) / Entry Price
```

The signal processor ensures:
- Position size does not exceed allocated capital × max leverage
- Sufficient margin is available before placing orders
- Risk per trade is proportional to strategy allocation

## Drawdown Monitoring

### How Drawdown is Calculated

```
Drawdown % = (Peak Equity - Current Equity) / Peak Equity × 100
```

- **Peak Equity**: The highest equity value ever recorded for the account
- **Current Equity**: Real-time equity from the exchange (balance + unrealized P&L)
- Updated every 30 seconds by the circuit breaker evaluator

### Drawdown Zones

| Zone | Drawdown Range | Status | Action |
|------|---------------|--------|--------|
| Normal | 0% – 10% | Green | No restrictions |
| Warning | 10% – 15% | Yellow | Monitor closely, strategy CB may trigger |
| Danger | 15% – 25% | Orange | Strategy CBs triggered, review positions |
| Critical | 25%+ | Red | Portfolio CB triggered, all trading halted |

### Drawdown Gauge

The portfolio dashboard displays a visual gauge showing:
- Current drawdown percentage
- Color-coded zones
- Circuit breaker threshold markers

## Risk Rules

### Pre-Trade Checks

Before any order is placed, the system verifies:

1. **Balance check**: Sufficient available margin
2. **Allocation check**: Position within strategy's capital allocation
3. **Leverage check**: Not exceeding max leverage
4. **Circuit breaker check**: Strategy and portfolio not halted
5. **Geo-block check**: Server not in a restricted jurisdiction

### Stop Loss / Take Profit

Every trade has mandatory SL/TP levels set by the strategy:

| Strategy | Stop Loss | Take Profit |
|----------|----------|-------------|
| Trend Following | 2x ATR | 3x ATR + trailing (1.5x ATR) |
| Mean Reversion | 1.5x ATR | Middle Bollinger Band |
| Funding Carry | 2.5x ATR | Funding normalization |
| Cross Momentum | ATR-based (per position) | Weekly rebalance |

SL/TP orders are placed on the exchange immediately after the entry fill is confirmed.

## Manual Controls

### Pause Individual Strategy

From the Strategies tab, you can pause any strategy. This:
- Stops new signal generation
- Keeps existing positions open
- Can be resumed at any time

### Force Resume Circuit Breaker

From the Portfolio dashboard, admins can force-resume a triggered circuit breaker. Use with caution — the drawdown that triggered the CB is still present.

### Close Individual Positions

From the Trading view, you can manually close any position at market price, regardless of strategy signals.

## Notifications

When configured, Slack notifications are sent for:
- Circuit breaker triggers (portfolio and strategy level)
- Circuit breaker auto-resumes
- Drawdown alerts when entering warning/danger zones

Configure Slack notifications in `server/.env`:
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#algo-trading
```

## Best Practices

1. **Start with testnet**: Run all strategies on Bybit testnet before going live
2. **Small positions first**: Use minimal position sizes for the first 1-2 weeks of live trading
3. **Monitor daily**: Check the portfolio dashboard at least once per day
4. **Don't override circuit breakers casually**: They exist to protect your capital
5. **Review after drawdowns**: When circuit breakers trigger, analyze what happened before resuming
6. **Keep leverage low**: The maximum leverage limits are already conservative — don't increase them
