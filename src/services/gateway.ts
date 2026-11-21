import { CellApi } from './api';
import { CellClient } from './client';
import { localStore } from './storage';
import { saveSession } from './session';

export const apiBaseUrl = (
  process.env.EXPO_PUBLIC_CELL_API_URL || 'https://cell-griot.pages.dev'
).replace(/\/$/, '');
export const supabaseUrl = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://oxulnwbwpfxwjbvxlrga.supabase.co'
).replace(/\/$/, '');
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_aEBNlthmZizezIeYKodSnw_0ndTYG42';
export const gateway = new CellClient(
  new CellApi(
    { apiUrl: apiBaseUrl, supabaseUrl, publishableKey: supabaseAnonKey },
    fetch,
    saveSession,
  ),
  localStore,
);
