// Bybit error translation — user-friendly messages

const ERROR_MAP: Record<string, string> = {
  'ab not enough for new order': 'Insufficient balance: Not enough funds to place this order.',
  'insufficient balance': 'Insufficient balance: Not enough funds in your account.',
  'insufficient available balance': 'Insufficient available balance: Funds may be locked in open orders or positions.',
  'order cost is too high': 'Order cost exceeds available balance. Reduce quantity or add more funds.',
  'leverage is too high': 'Leverage exceeds maximum for this symbol. Reduce leverage.',
  'qty has been restricted': 'Order quantity is outside allowed limits for this symbol.',
  'price has been restricted': 'Order price is outside allowed range for this symbol.',
  'order not exists': 'Order not found. It may have already been filled or cancelled.',
  'position not exists': 'Position not found for this symbol.',
};

export function translateBybitError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return `Exchange error: ${errorMessage}`;
}

export class BybitApiError extends Error {
  public readonly code: string;
  public readonly rawMessage: string;

  constructor(code: string, message: string) {
    super(translateBybitError(message));
    this.name = 'BybitApiError';
    this.code = code;
    this.rawMessage = message;
  }
}
