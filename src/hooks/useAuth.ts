import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

export function useAuth() {
  const { user, token, isAuthenticated, login, logout, updateUser } = useAuthStore();

  useEffect(() => {
    if (token) {
      api.setToken(token);
      if (!user) {
        api.getMe().then((u) => updateUser(u)).catch(() => logout());
      }
    }
  }, [token, user]);

  const handleLogin = async (username: string, password: string) => {
    const result = await api.login(username, password);
    api.setToken(result.token);
    login(result.user, result.token);
    return result;
  };

  const handleLogout = () => {
    api.setToken(null);
    logout();
  };

  return { user, isAuthenticated, login: handleLogin, logout: handleLogout };
}
