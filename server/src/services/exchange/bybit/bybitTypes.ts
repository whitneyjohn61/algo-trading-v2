// Raw Bybit V5 API response shapes
// Documented field ambiguities from V1 experience

export interface BybitRawBalance {
  coin: string;
  walletBalance?: string;
  transferBalance?: string;
  availableToWithdraw?: string;
  equity?: string;
  unrealisedPnl?: string; // British spelling
  totalOrderIM?: string;
  totalPositionIM?: string;
}

export interface BybitRawAccountInfo {
  totalEquity?: string;
  totalWalletBalance?: string;
  totalAvailableBalance?: string;
  accountType?: string;
}

export interface BybitRawPosition {
  symbol: string;
  side: string; // 'Buy' | 'Sell' | 'None'
  size: string;
  avgPrice?: string;
  entryPrice?: string; // alias for avgPrice
  markPrice: string;
  unrealisedPnl: string; // British spelling
  positionBalance?: string; // NOT positionMargin
  leverage: string;
  liqPrice: string;
  stopLoss?: string;
  takeProfit?: string;
  positionIdx?: string;
  tradeMode?: string;
}

export interface BybitRawOrder {
  // Ambiguous fields — check both names
  orderId?: string;
  orderLinkId?: string;
  symbol: string;
  side: string; // 'Buy' | 'Sell'
  orderType?: string; // or 'type'
  type?: string;
  qty?: string; // or 'quantity'
  quantity?: string;
  price?: string;
  triggerPrice?: string;
  orderStatus?: string; // or 'status'
  status?: string;
  cumExecQty?: string;
  avgPrice?: string;
  cumExecFee?: string;
  timeInForce?: string;
  reduceOnly?: boolean;
  createdTime?: string; // or 'createTime' or 'createdAt'
  createTime?: string;
  createdAt?: string;
  updatedTime?: string;
}

export interface BybitRawCandle {
  // Kline array: [startTime, open, high, low, close, volume, turnover]
  // Bybit returns reverse chronological — must reverse
  // Timestamps in milliseconds
  // Bybit's end time is 1ms short — calculate from start + interval
  0: string; // startTime
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
  5: string; // volume
  6: string; // turnover
}

export interface BybitRawTicker {
  symbol: string;
  lastPrice: string;
  bid1Price: string;
  ask1Price: string;
  volume24h: string;
  turnover24h: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
}

export interface BybitRawFundingRate {
  symbol: string;
  fundingRate: string;
  nextFundingTime: string;
}

export interface BybitRawSymbolInfo {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  lotSizeFilter: {
    minOrderQty: string;
    maxOrderQty: string;
    qtyStep: string;
  };
  priceFilter: {
    minPrice: string;
    maxPrice: string;
    tickSize: string;
  };
  leverageFilter: {
    minLeverage: string;
    maxLeverage: string;
  };
}

// Interval mapping: minutes → Bybit string
export const INTERVAL_MAP: Record<number, string> = {
  1: '1', 3: '3', 5: '5', 15: '15', 30: '30',
  60: '60', 120: '120', 240: '240', 360: '360', 720: '720',
  1440: 'D', 10080: 'W', 43200: 'M',
};

// Reverse mapping: Bybit string → minutes
export const INTERVAL_MINUTES: Record<string, number> = {
  '1': 1, '3': 3, '5': 5, '15': 15, '30': 30,
  '60': 60, '120': 120, '240': 240, '360': 360, '720': 720,
  'D': 1440, 'W': 10080, 'M': 43200,
};

// POL → MATIC coin mapping
export const COIN_ALIASES: Record<string, string> = {
  'POL': 'MATIC',
};
