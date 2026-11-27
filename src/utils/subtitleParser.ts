export interface ParsedSubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export function parseSubtitleTimestampMs(raw: string): number {
  const cleaned = raw.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return Math.round((mins * 60 + secs) * 1000);
  }
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return Math.round((hours * 3600 + mins * 60 + secs) * 1000);
  }
  return 0;
}

export function formatTimecodeMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safe / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatSrtTimeMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safe / 3600000);
  const mins = Math.floor((safe % 3600000) / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/**
 * Parses .SRT and .VTT subtitle files into sorted dialogue cues.
 */
export function parseSubtitleText(raw: string): ParsedSubtitleCue[] {
  const normalized = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .trim();

  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const cues: ParsedSubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;
    if (lines[0].startsWith('NOTE') || lines[0].startsWith('STYLE')) continue;

    let timeIdx = 0;
    let indexNum = cues.length + 1;
    if (/^\d+$/.test(lines[0])) {
      indexNum = parseInt(lines[0], 10);
      timeIdx = 1;
    }

    const timeLine = lines[timeIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startRaw, endRawMeta] = timeLine.split('-->');
    const endRaw = endRawMeta.trim().split(/\s+/)[0];
    const startMs = parseSubtitleTimestampMs(startRaw);
    const endMs = parseSubtitleTimestampMs(endRaw);
    if (endMs <= startMs) continue;

    const text = lines
      .slice(timeIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]+\}/g, '')
      .trim();

    if (!text) continue;
    cues.push({ index: indexNum, startMs, endMs, text });
  }

  return cues
    .sort((a, b) => a.startMs - b.startMs)
    .map((c, idx) => ({ ...c, index: idx + 1 }));
}

export function buildHindiSrt(
  segments: Array<{ startMs: number; endMs: number; hindiText: string; englishText: string; audioType: string }>
): string {
  const speech = segments.filter((s) => s.audioType === 'SPEECH');
  return speech
    .map((s, idx) => {
      const line = (s.hindiText || s.englishText || '').trim();
      return `${idx + 1}\n${formatSrtTimeMs(s.startMs)} --> ${formatSrtTimeMs(s.endMs)}\n${line}`;
    })
    .join('\n\n')
    .concat('\n');
}

export function buildBilingualSrt(
  segments: Array<{ startMs: number; endMs: number; hindiText: string; englishText: string; audioType: string }>
): string {
  const speech = segments.filter((s) => s.audioType === 'SPEECH');
  return speech
    .map((s, idx) => {
      const hi = (s.hindiText || '').trim();
      const en = (s.englishText || '').trim();
      const body = hi && en ? `${hi}\n${en}` : hi || en;
      return `${idx + 1}\n${formatSrtTimeMs(s.startMs)} --> ${formatSrtTimeMs(s.endMs)}\n${body}`;
    })
    .join('\n\n')
    .concat('\n');
}
