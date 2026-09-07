const API_BASE = '/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    const token = this.token || localStorage.getItem('token');
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  }

  async login(username: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async register(data: any) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getUsers() {
    return this.request('/auth/users');
  }

  async updateUser(id: number, data: any) {
    return this.request(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async resetPassword(id: number, password: string) {
    return this.request(`/auth/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  }

  async getFacilities() {
    return this.request('/facilities');
  }

  async getAllFacilities() {
    return this.request('/facilities/all');
  }

  async createFacility(data: any) {
    return this.request('/facilities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createFacilityWithAccount(data: any) {
    return this.request('/facilities/with-account', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFacility(id: number, data: any) {
    return this.request(`/facilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFacility(id: number) {
    return this.request(`/facilities/${id}`, {
      method: 'DELETE',
    });
  }

  async getCases(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/cases?${query}`);
  }

  async getCase(id: number) {
    return this.request(`/cases/${id}`);
  }

  async getCaseStats() {
    return this.request('/cases/stats');
  }

  async createCase(data: any) {
    return this.request('/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCase(id: number, data: any) {
    return this.request(`/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCase(id: number) {
    return this.request(`/cases/${id}`, {
      method: 'DELETE',
    });
  }

  async importCases(cases: any[]) {
    return this.request('/cases/import', {
      method: 'POST',
      body: JSON.stringify({ cases }),
    });
  }

  async syncCases(cases: any[]) {
    return this.request('/cases/sync', {
      method: 'POST',
      body: JSON.stringify({ cases }),
    });
  }

  async exportCases(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/cases/export?${query}`);
  }

  async getReport(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports/generate?${query}`);
  }

  async getAuditLogs(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports/audit?${query}`);
  }

  async getNotifications() {
    return this.request('/notifications');
  }

  async getUnreadCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationRead(id: number) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  async sendNotification(data: any) {
    return this.request('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateData(count: number = 20) {
    return this.request('/cases/generate', {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
  }
}

export const api = new ApiService();
