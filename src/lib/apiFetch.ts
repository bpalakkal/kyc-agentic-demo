/**
 * Auth-aware wrapper around fetch.
 * Automatically injects the current Supabase session JWT as a Bearer token
 * so every call to the Express backend passes the C3 authentication check.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

let currentSession: Session | null = null;

// Initialize session tracking on module load
supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
});

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = currentSession?.access_token;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
