import * as SecureStore from 'expo-secure-store';
import type { UiAnswer } from '../types';

const KEY = 'cell_ui_answers_v1';
const MAX = 200;

/** Answers to interactive smart-UI blocks, keyed by answerKey(ui, blockId). */
export async function loadUiAnswers(): Promise<Record<string, UiAnswer>> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Record<string, UiAnswer>) : {};
  } catch {
    return {};
  }
}

export async function saveUiAnswer(key: string, answer: UiAnswer): Promise<Record<string, UiAnswer>> {
  const current = await loadUiAnswers();
  const entries = Object.entries({ ...current, [key]: answer }).slice(-MAX);
  const next = Object.fromEntries(entries);
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: block just won't stay locked after restart
  }
  return next;
}
