/**
 * useWebSocket hook integration tests.
 * Mocks the WebSocket constructor to test connection lifecycle, messaging, and reconnection.
 */

// ── Mock WebSocket globally BEFORE any imports that use it ──

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = 0;
  onopen: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose({});
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen({});
  }

  simulateMessage(data: any) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = 3;
    if (this.onclose) this.onclose({});
  }

  simulateError() {
    if (this.onerror) this.onerror({});
  }
}

// Set up BEFORE module loads (this line runs at module scope before imports are resolved
// because jest hoists jest.mock, but our global assignment also needs to happen early)
(global as any).WebSocket = MockWebSocket;

import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '@/store/authStore';
import { useAccountStore } from '@/store/accountStore';
import { useWebSocket } from '@/hooks/useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];

    // Set up authenticated state
    act(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 1, username: 'test', email: 'test@test.com', role: 'admin' },
        token: 'test-token',
      });

      useAccountStore.setState({
        accounts: [{ id: 1, userId: 1, exchange: 'bybit', isTest: true, isActive: true, currentBalance: 10000, hasApiKeys: true }],
        activeAccountId: 1,
        mode: 'test',
        loading: false,
      });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => {
      useAuthStore.setState({ isAuthenticated: false, user: null, token: null });
    });
  });

  it('should connect when authenticated', () => {
    renderHook(() => useWebSocket());

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]!.url).toContain('/ws');
  });

  it('should not connect when not authenticated', () => {
    act(() => {
      useAuthStore.setState({ isAuthenticated: false });
    });

    renderHook(() => useWebSocket());

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('should report connected state after open', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.isConnected).toBe(false);

    act(() => {
      MockWebSocket.instances[0]!.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionState).toBe('connected');
  });

  it('should send auth message on connect', () => {
    renderHook(() => useWebSocket());

    act(() => {
      MockWebSocket.instances[0]!.simulateOpen();
    });

    const sent = MockWebSocket.instances[0]!.sentMessages;
    expect(sent.length).toBeGreaterThanOrEqual(1);

    const authMsg = JSON.parse(sent[0]!);
    expect(authMsg.type).toBe('auth');
    expect(authMsg.userId).toBe(1);
    expect(authMsg.tradingAccountId).toBe(1);
  });

  it('should report disconnected on close', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      MockWebSocket.instances[0]!.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      MockWebSocket.instances[0]!.simulateClose();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionState).toBe('disconnected');
  });

  it('should report error state on error', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      MockWebSocket.instances[0]!.simulateError();
    });

    expect(result.current.connectionState).toBe('error');
  });

  it('should call custom onMessage handler', () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket({ onMessage }));

    act(() => {
      MockWebSocket.instances[0]!.simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0]!.simulateMessage({ type: 'test', data: { foo: 'bar' } });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'test', data: { foo: 'bar' } });
  });

  it('should attempt reconnect on close', () => {
    renderHook(() => useWebSocket());

    act(() => {
      MockWebSocket.instances[0]!.simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0]!.simulateClose();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    // Advance timer past reconnect delay (2s base)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // A new WebSocket should have been created
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('should close WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());

    const ws = MockWebSocket.instances[0]!;
    act(() => {
      ws.simulateOpen();
    });

    unmount();

    expect(ws.readyState).toBe(3);
  });

  it('should provide send function', () => {
    const { result } = renderHook(() => useWebSocket());
    expect(typeof result.current.send).toBe('function');
  });
});
