<!-- title: Portfolio | category: User Guide -->

# Portfolio Management

The portfolio system manages capital allocation across all strategies, tracks equity, and provides performance analytics.

## Portfolio Dashboard

The **Portfolio** tab is the main view after login. It displays:

- **Total Equity**: Current portfolio value from the exchange
- **Unrealized P&L**: Open position profits/losses
- **Realized P&L Today**: Closed trade profits/losses for the day
- **Peak Equity**: Highest equity value recorded
- **Current Drawdown**: Percentage decline from peak equity
- **Open Positions**: Number of active positions across all strategies

## Capital Allocation

Each strategy receives a fixed percentage of the total portfolio capital:

| Strategy | Allocation |
|----------|-----------|
| Trend Following | 30% |
| Mean Reversion | 20% |
| Funding Carry | 20% |
| Cross-Sectional Momentum | 30% |

The portfolio manager calculates each strategy's available capital based on:
- Total account equity
- Strategy allocation percentage
- Currently used margin

### Allocation View

The dashboard shows a breakdown of each strategy's:
- Target allocation percentage
- Current equity usage
- Actual allocation percentage
- Active position count
- Unrealized P&L

## Equity Tracking

### Snapshots

The equity tracker captures a snapshot every **5 minutes** for each trading account, recording:
- Total equity
- Unrealized P&L
- Realized P&L today
- Peak equity
- Drawdown percentage
- Position count
- Strategy allocations

### Equity Curve

The **Equity Curve** chart shows historical portfolio value over time. You can adjust the time range to view:
- Last 24 hours
- Last 7 days
- Last 30 days
- All time

## Performance Metrics

### Aggregate Performance

Available for different periods (day, week, month, all):

| Metric | Description |
|--------|-------------|
| Return % | Total return for the period |
| Sharpe Ratio | Risk-adjusted return (annualized) |
| Max Drawdown | Largest peak-to-trough decline |
| Total P&L | Absolute profit/loss |
| Data Points | Number of equity snapshots in the period |

### Per-Strategy Performance

Each strategy's performance is tracked independently:
- Total P&L
- Win count / Loss count
- Win rate
- Max drawdown
- Sharpe ratio
- Current allocation percentage

## Drawdown Monitoring

Drawdown is calculated as the percentage decline from the recorded peak equity:

```
Drawdown % = (Peak Equity - Current Equity) / Peak Equity × 100
```

The system maintains a running peak equity value. When equity reaches a new high, the peak is updated and drawdown resets to 0%.

### Drawdown Gauge

The dashboard includes a visual drawdown gauge showing:
- Current drawdown percentage
- Warning zone (10–15%)
- Danger zone (15–25%)
- Circuit breaker threshold (25%)

## Circuit Breaker Status

The portfolio dashboard shows the current circuit breaker status:
- **Active**: Normal operation, all strategies running
- **Triggered (Portfolio)**: All strategies halted due to portfolio drawdown > 25%
- **Triggered (Strategy)**: Individual strategy halted due to strategy drawdown > 15%

See [Risk Management](./RISK-MANAGEMENT.md) for full circuit breaker details.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/summary` | GET | Full portfolio summary |
| `/api/portfolio/equity-curve` | GET | Historical equity data |
| `/api/portfolio/performance` | GET | Aggregate performance metrics |
| `/api/portfolio/performance/:strategyId` | GET | Per-strategy performance |
| `/api/portfolio/circuit-breaker` | GET | Circuit breaker status |
| `/api/portfolio/circuit-breaker/resume` | POST | Force-resume circuit breaker |

All portfolio endpoints require authentication and a trading account context.
