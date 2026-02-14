import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wanyyielmkghxdxjchyf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhbnl5aWVsbWtnaHhkeGpjaHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5Nzg3NjAsImV4cCI6MjA4NjU1NDc2MH0.ON0oafTlbZUlP6xynKCQ5UHB92v5DOppHA2dDP8A_Ts';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'cowrite-web'
    }
  }
});
