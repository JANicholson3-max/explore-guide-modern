import { supabase } from './supabase';

// TEMP UX-only: swap to a profiles.role check when you add profiles
const ADMIN_EMAIL = 'JANicholson3@aol.com';

export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}