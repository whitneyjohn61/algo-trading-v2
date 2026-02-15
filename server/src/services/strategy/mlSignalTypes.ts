/**
 * ML Signal Types — interface for the future FreqTrade-based ML container.
 *
 * The ML service will run in its own Docker container and communicate
 * via HTTP API or Redis pub/sub to provide trading signals.
 *
 * Integration points:
 *  - Strategy executor checks for ML signals before/after its own logic
 *  - ML signals can confirm, veto, or independently trigger entries/exits
 *  - Signal confidence score determines position sizing adjustment
 */

export type MLSignalDirection = 'long' | 'short' | 'neutral';
export type MLSignalAction = 'entry' | 'exit' | 'hold' | 'adjust';

export interface MLSignal {
  /** Unique signal ID */
  id: string;
  /** Symbol this signal applies to */
  symbol: string;
  /** Predicted direction */
  direction: MLSignalDirection;
  /** Recommended action */
  action: MLSignalAction;
  /** Confidence score 0-1 (used for position sizing adjustment) */
  confidence: number;
  /** Which model produced this signal */
  modelId: string;
  /** Model version for tracking */
  modelVersion: string;
  /** Timeframe the model was trained on */
  timeframe: string;
  /** Target price (optional) */
  targetPrice?: number;
  /** Suggested stop loss (optional) */
  suggestedStopLoss?: number;
  /** Suggested take profit (optional) */
  suggestedTakeProfit?: number;
  /** Feature importance / reasoning (optional, for logging) */
  features?: Record<string, number>;
  /** When the signal was generated (UTC ms) */
  generatedAt: number;
  /** When the signal expires (UTC ms) — don't act on stale signals */
  expiresAt: number;
}

export interface MLModelStatus {
  modelId: string;
  modelVersion: string;
  status: 'online' | 'offline' | 'training' | 'error';
  lastSignalAt?: number;
  accuracy?: number;
  totalSignals?: number;
  winRate?: number;
}

/**
 * Interface for the ML signal provider.
 * Implemented by the HTTP client that talks to the FreqTrade ML container.
 */
export interface MLSignalProvider {
  /** Check if the ML service is reachable */
  isAvailable(): Promise<boolean>;
  /** Get latest signal for a symbol */
  getSignal(symbol: string, timeframe: string): Promise<MLSignal | null>;
  /** Get signals for multiple symbols (batch) */
  getSignals(symbols: string[], timeframe: string): Promise<MLSignal[]>;
  /** Get model status */
  getModelStatus(modelId?: string): Promise<MLModelStatus[]>;
}

/**
 * How strategies should incorporate ML signals:
 *
 * 1. CONFIRM mode: Strategy generates signal -> check ML agrees -> execute
 * 2. VETO mode:    Strategy generates signal -> check ML doesn't disagree -> execute
 * 3. BOOST mode:   Strategy generates signal -> use ML confidence for sizing
 * 4. INDEPENDENT:  ML signal triggers entry/exit on its own (Strategy 5?)
 */
export type MLIntegrationMode = 'confirm' | 'veto' | 'boost' | 'independent';
