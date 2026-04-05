import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  clearSession,
  getStoredUser,
  loginRequest,
  setSession,
  TOKEN_KEY
} from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? null);
  const [user, setUser] = useState(() => getStoredUser());

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password);
    setToken(data.token);
    setUser(data.user);
    setSession(data.token, data.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearSession();
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === 'admin',
      login,
      logout
    }),
    [token, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
