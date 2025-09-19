import apiService from './api';

class AuthService {
  constructor() {
    this.user = this.getStoredUser();
    this.token = this.getStoredToken();
  }

  getStoredUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  getStoredToken() {
    return localStorage.getItem('token');
  }

  isAuthenticated() {
    return !!(this.token && this.user);
  }

  async login(username, password) {
    try {
      const data = await apiService.login(username, password);

      this.user = data.user;
      this.token = data.token;

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);

      return { success: true, user: data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  }

  async register(username, email, password) {
    try {
      const data = await apiService.register(username, email, password);

      this.user = data.user;
      this.token = data.token;

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);

      return { success: true, user: data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  }

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  getCurrentUser() {
    return this.user;
  }
}

export default new AuthService();