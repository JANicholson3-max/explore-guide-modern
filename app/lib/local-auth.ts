// Simple in-memory storage for demo purposes
// In a real app, you'd use AsyncStorage or SecureStore
let users: any[] = [
  // Add a test user for testing purposes
  { id: '1', email: 'test@test.com', password: 'test123', createdAt: new Date().toISOString() }
];
let currentUser: any = null;

export interface LocalUser {
  id: string;
  email: string;
  createdAt: string;
}

// Simple local authentication system as fallback
export const localAuth = {
  async signUp(email: string, password: string): Promise<{ user: LocalUser | null; error: string | null }> {
    try {
      // Check if user already exists
      if (users.find(u => u.email === email)) {
        return { user: null, error: 'User already exists' };
      }

      // Create new user
      const user: LocalUser = {
        id: Date.now().toString(),
        email,
        createdAt: new Date().toISOString(),
      };

      // Store user
      users.push(user);
      currentUser = user;
      
      return { user, error: null };
    } catch (error) {
      return { user: null, error: 'Failed to create account' };
    }
  },

  async signIn(email: string, password: string): Promise<{ user: LocalUser | null; error: string | null }> {
    try {
      const user = users.find(u => u.email === email);
      
      if (!user) {
        return { user: null, error: 'User not found' };
      }

      currentUser = user;
      return { user, error: null };
    } catch (error) {
      return { user: null, error: 'Failed to sign in' };
    }
  },

  async getCurrentUser(): Promise<LocalUser | null> {
    return currentUser;
  },

  async signOut(): Promise<void> {
    currentUser = null;
  },

  async getUsers(): Promise<LocalUser[]> {
    return users;
  },
};