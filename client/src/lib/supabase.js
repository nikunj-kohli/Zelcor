import { createClient } from '@supabase/supabase-js';

async function loadSupabaseConfig() {
  const fallbackUrl = import.meta.env.VITE_SUPABASE_URL;
  const fallbackAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const response = await fetch('http://localhost:3000/api/public-config');
    if (!response.ok) throw new Error('Failed to load public config');
    const config = await response.json();

    return {
      supabaseUrl: config.supabaseUrl || fallbackUrl,
      supabaseAnonKey: config.supabaseAnonKey || fallbackAnonKey,
    };
  } catch {
    return {
      supabaseUrl: fallbackUrl,
      supabaseAnonKey: fallbackAnonKey,
    };
  }
}

const { supabaseUrl, supabaseAnonKey } = await loadSupabaseConfig();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase config missing. Start backend and set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
