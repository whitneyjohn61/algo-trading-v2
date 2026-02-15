<!-- title: Backtesting | category: User Guide -->

# Backtesting

Run historical simulations of individual strategies or the full portfolio to evaluate performance before live trading.

## Overview

The backtesting engine simulates strategy execution against historical candle data from Bybit. It supports:

- **Single-strategy backtests**: Test one strategy on one symbol
- **Portfolio backtests**: Test multiple strategies simultaneously with shared capital
- **Parameter tuning**: Override strategy parameters to find optimal settings
- **Custom fees/slippage**: Simulate realistic execution costs

## Running a Backtest

### From the UI

1. Navigate to the **Backtest** tab
2. Select a strategy (or multiple for portfolio backtest)
3. Configure parameters:
   - **Symbol**: Trading pair (e.g., BTCUSDT)
   - **Interval**: Candle interval (e.g., 15m, 1H, 4H, 1D)
   - **Date Range**: Start and end dates
   - **Initial Balance**: Starting capital (USDT)
   - **Leverage**: Maximum leverage to use
4. Click **Run Backtest**
5. View results in the results panel

### From the CLI

```bash
# Single strategy
npx ts-node scripts/backtest/run-backtest.ts \
  --strategy trend_following \
  --symbol BTCUSDT \
  --interval 240 \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --balance 10000

# Portfolio backtest
npx ts-node scripts/backtest/run-portfolio-backtest.ts \
  --symbol BTCUSDT \
  --interval 240 \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --balance 50000
```

## Backtest Results

### Summary Metrics

| Metric | Description |
|--------|-------------|
| Total Return % | Overall profit/loss percentage |
| Net Profit | Absolute profit in USDT |
| Total Trades | Number of trades executed |
| Win Rate | Percentage of profitable trades |
| Profit Factor | Gross profit / gross loss |
| Max Drawdown | Largest peak-to-trough decline |
| Sharpe Ratio | Risk-adjusted return |
| Average Trade | Mean P&L per trade |
| Best Trade | Largest single trade profit |
| Worst Trade | Largest single trade loss |

### Equity Curve

The equity curve chart shows the portfolio value over the backtest period. Look for:
- **Smooth upward slope**: Consistent profitability
- **Sharp drawdowns**: Risk management opportunities
- **Flat periods**: Strategy may not be suited for that market regime

### Trade List

Each simulated trade includes:
- Entry/exit timestamps and prices
- Direction (long/short)
- Quantity and leverage
- P&L and fees
- Strategy that generated the signal

## Interpreting Results

### Good Backtest Characteristics

- **Win rate > 40%** with good risk/reward ratio
- **Profit factor > 1.5**: Profits significantly exceed losses
- **Max drawdown < 20%**: Acceptable risk level
- **Sharpe ratio > 1.0**: Decent risk-adjusted returns
- **Consistent equity curve**: Not dependent on a few lucky trades

### Warning Signs

- **Win rate > 80%**: May indicate curve-fitting or unrealistic conditions
- **Only profitable in one direction**: May not survive regime changes
- **Max drawdown > 30%**: Too much risk for the return
- **Very few trades**: Not enough data for statistical significance
- **All profits from 1-2 trades**: Not a robust strategy

## Fees and Slippage

### Default Settings

| Parameter | Default | Description |
|-----------|---------|-------------|
| Taker Fee | 0.06% | Bybit taker fee rate |
| Slippage | 0.05% | Estimated slippage per trade |

### Custom Settings

You can override fees and slippage in the backtest configuration to simulate different scenarios:
- **Low fees**: Maker orders or VIP fee tiers
- **High slippage**: Illiquid markets or large position sizes
- **Zero fees**: Isolate strategy alpha from execution costs

## Parameter Overrides

Each strategy has configurable parameters that can be overridden during backtesting:

### Trend Following
- EMA periods (fast/slow)
- ADX threshold
- ATR multipliers for SL/TP

### Mean Reversion
- Bollinger Band period and standard deviation
- RSI period and thresholds
- Time stop duration

### Funding Carry
- Z-score entry/exit thresholds
- Maximum holding period

### Cross Momentum
- ROC lookback periods
- Number of long/short positions
- Rebalance frequency

## Saving and Managing Runs

### Save to Database

Check **Save to DB** before running to persist results. Saved runs can be:
- Reviewed later from the Backtest tab
- Compared across different parameter sets
- Deleted when no longer needed

### Viewing Past Runs

The Backtest tab shows a list of saved runs with:
- Strategy name
- Symbol and interval
- Date range
- Key metrics (return, trades, win rate)
- Run timestamp

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/backtest/strategies` | GET | List available strategies |
| `/api/backtest/run` | POST | Run single-strategy backtest |
| `/api/backtest/portfolio-run` | POST | Run portfolio backtest |
| `/api/backtest/runs` | GET | List saved runs |
| `/api/backtest/runs/:id` | GET | Get run details + trades |
| `/api/backtest/runs/:id` | DELETE | Delete a saved run |

All backtest endpoints require authentication.
