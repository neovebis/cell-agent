import type { CaptureItem, FileAttachment, Session } from '../types';
import { validateAttachments } from './contracts';
export function guessMime(name: string, fallback?: string): string {
  const known: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    json: 'application/json',
    svg: 'image/svg+xml',
  };
  return (
    known[name.split('.').pop()?.toLowerCase() || ''] ||
    (fallback && fallback !== 'application/octet-stream'
      ? fallback
      : 'text/plain')
  );
}
export async function readAttachment(
  uri: string,
  name: string,
  mimeType: string,
  size?: number,
  base64?: string,
): Promise<FileAttachment> {
  if (size && size > 2 * 1024 * 1024)
    throw new Error('Cada ficheiro pode ter até 2 MiB.');
  if (!base64) {
    if (!uri.startsWith('blob:') && !uri.startsWith('data:'))
      throw new Error('Ficheiro local inválido.');
    const blob = await (await fetch(uri)).blob();
    if (blob.size > 2 * 1024 * 1024)
      throw new Error('Cada ficheiro pode ter até 2 MiB.');
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new Error('Não foi possível ler o ficheiro.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
  }
  const file = {
    name,
    mimeType: guessMime(name, mimeType),
    data: base64,
    size,
  };
  validateAttachments([file]);
  return file;
}
export async function persistCapture(
  item: Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>,
  _session: Session,
): Promise<Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>> {
  if (!item.uri) return item;
  const file = await readAttachment(
    item.uri,
    item.title,
    item.mimeType || '',
    item.size,
    item.base64,
  );
  return {
    ...item,
    uri: `data:${file.mimeType};base64,${file.data}`,
    base64: undefined,
  };
}
export async function clearCaptureFiles(_session: Session): Promise<void> {}
