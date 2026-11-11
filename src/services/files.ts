import * as FileSystem from 'expo-file-system/legacy';
import type { CaptureItem, FileAttachment, Session } from '../types';
import { newMessageId, validateAttachments } from './contracts';

export function guessMime(name: string, fallback?: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
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
    known[extension || ''] ||
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
  if (!uri.startsWith('file:') && !uri.startsWith('content:') && !base64)
    throw new Error('Ficheiro local inválido.');
  if (!base64 && uri.startsWith('file:')) {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory)
      throw new Error('O ficheiro já não está disponível neste dispositivo.');
    if (info.size > 2 * 1024 * 1024)
      throw new Error('Cada ficheiro pode ter até 2 MiB.');
  }
  const data =
    base64 ||
    (await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
  const file = { name, mimeType: guessMime(name, mimeType), data, size };
  validateAttachments([file]);
  return file;
}
export async function persistCapture(
  item: Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>,
  session: Session,
): Promise<Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>> {
  if (!item.uri) return item;
  if (!session.userId || !session.workspaceId || !FileSystem.documentDirectory)
    throw new Error('Armazenamento local indisponível.');
  if (
    ![session.userId, session.workspaceId].every((id) =>
      /^[A-Za-z0-9_-]{1,128}$/.test(id),
    )
  )
    throw new Error('Identidade de armazenamento inválida.');
  const folder =
    FileSystem.documentDirectory +
    `captures/${encodeURIComponent(session.userId)}/${encodeURIComponent(session.workspaceId)}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const extension =
    item.title
      .split('.')
      .pop()
      ?.match(/^[a-z0-9]{1,8}$/i)?.[0] ||
    (item.type === 'image' ? 'jpg' : 'bin');
  const uri = folder + newMessageId() + '.' + extension;
  await FileSystem.copyAsync({ from: item.uri, to: uri });
  return { ...item, uri, base64: undefined };
}
export async function clearCaptureFiles(session: Session): Promise<void> {
  if (!session.userId || !FileSystem.documentDirectory) return;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(session.userId))
    throw new Error('Identidade de armazenamento inválida.');
  const folder =
    FileSystem.documentDirectory +
    `captures/${encodeURIComponent(session.userId)}/`;
  await FileSystem.deleteAsync(folder, { idempotent: true });
}
