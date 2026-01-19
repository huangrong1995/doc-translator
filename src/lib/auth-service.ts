import { nanoid } from 'nanoid';

export interface User {
  id: string;
  email: string;
  name: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  customModelName?: string;
  createdAt: number;
}

const STORAGE_KEY_USERS = 'doctranslator_users';
const STORAGE_KEY_CURRENT_USER = 'doctranslator_current_user_id';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  async register(email: string, password: string, rememberMe: boolean = true): Promise<User> {
    await delay(500); // Simulate API call
    
    const users = this.getUsers();
    if (users.some(u => u.email === email)) {
      throw new Error('该邮箱已被注册');
    }

    const newUser: User = {
      id: nanoid(),
      email,
      name: email.split('@')[0], 
      createdAt: Date.now(),
    };

    // Storing password (even mocked) in localStorage is bad practice, but for a "Pure Frontend Demo"
    users.push({ ...newUser, _password: password } as any);
    this.saveUsers(users);
    
    // Auto login after register
    await this.login(email, password, rememberMe);
    return newUser;
  },

  async login(email: string, password: string, rememberMe: boolean = true): Promise<User> {
    await delay(500);
    
    const users = this.getUsers();
    const user = users.find(u => u.email === email && (u as any)._password === password);
    
    if (!user) {
      throw new Error('邮箱或密码错误');
    }

    // Clear potentially conflicting storage
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    sessionStorage.removeItem(STORAGE_KEY_CURRENT_USER);

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, user.id);
    } else {
      sessionStorage.setItem(STORAGE_KEY_CURRENT_USER, user.id);
    }
    
    return user;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    sessionStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  },

  async getCurrentUser(): Promise<User | null> {
    // Try localStorage first (Remember Me), then sessionStorage (One-time session)
    const userId = localStorage.getItem(STORAGE_KEY_CURRENT_USER) || sessionStorage.getItem(STORAGE_KEY_CURRENT_USER);
    
    if (!userId) return null;
    
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  },

  async updateSettings(settings: { apiKey?: string; model?: string; baseUrl?: string; customModelName?: string }): Promise<User> {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) throw new Error('未登录');

    const users = this.getUsers();
    const index = users.findIndex(u => u.id === currentUser.id);
    
    if (index !== -1) {
      // Update only provided fields
      users[index] = { ...users[index], ...settings };
      this.saveUsers(users);
      return users[index];
    }
    
    throw new Error('用户不存在');
  },

  // Private helpers
  getUsers(): User[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    } catch {
      return [];
    }
  },

  saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }
};
