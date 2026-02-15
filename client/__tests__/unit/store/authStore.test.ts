/**
 * AuthStore unit tests — login, logout, updateUser.
 * Pure Zustand logic, no mocks needed.
 */

import { useAuthStore, User } from '@/store/authStore';

const testUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  timezone: 'UTC',
};

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  });

  it('should start with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('should set authenticated state on login', () => {
    useAuthStore.getState().login('jwt-token-123', testUser);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-token-123');
    expect(state.user).toEqual(testUser);
    expect(state.user!.username).toBe('testuser');
  });

  it('should clear state on logout', () => {
    useAuthStore.getState().login('jwt-token-123', testUser);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('should update partial user data', () => {
    useAuthStore.getState().login('jwt-token-123', testUser);
    useAuthStore.getState().updateUser({ timezone: 'America/New_York', avatar_path: '/avatar.png' });

    const state = useAuthStore.getState();
    expect(state.user!.timezone).toBe('America/New_York');
    expect(state.user!.avatar_path).toBe('/avatar.png');
    // Other fields should be preserved
    expect(state.user!.username).toBe('testuser');
    expect(state.user!.email).toBe('test@example.com');
  });

  it('should not update user when not logged in', () => {
    useAuthStore.getState().updateUser({ timezone: 'UTC+5' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('should preserve token across login calls', () => {
    useAuthStore.getState().login('token-1', testUser);
    useAuthStore.getState().login('token-2', { ...testUser, username: 'otheruser' });

    const state = useAuthStore.getState();
    expect(state.token).toBe('token-2');
    expect(state.user!.username).toBe('otheruser');
  });
});
