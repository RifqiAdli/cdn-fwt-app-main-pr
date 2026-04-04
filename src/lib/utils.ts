import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

export const getFileType = (mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive' | 'other' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (['application/pdf', 'application/msword', 'text/plain'].some(t => mimeType.includes(t))) return 'document';
  if (['application/json', 'text/javascript', 'text/html', 'text/css'].some(t => mimeType.includes(t))) return 'code';
  if (['application/zip', 'application/x-tar', 'application/x-rar'].some(t => mimeType.includes(t))) return 'archive';
  return 'other';
};

export const getFileColor = (type: ReturnType<typeof getFileType>): string => ({
  image: 'hsl(217, 91%, 68%)',
  video: 'hsl(263, 70%, 72%)',
  audio: 'hsl(160, 60%, 55%)',
  document: 'hsl(0, 90%, 67%)',
  code: 'hsl(45, 93%, 55%)',
  archive: 'hsl(27, 96%, 61%)',
  other: 'hsl(215, 14%, 63%)',
}[type]);

export const copyToClipboard = async (text: string): Promise<void> => {
  await navigator.clipboard.writeText(text);
};
