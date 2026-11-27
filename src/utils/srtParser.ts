import { GapInterval, SrtCue } from '../types/dubbing';

/**
 * Converts SRT timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm) to seconds.
 */
export function parseSrtTimestamp(ts: string): number {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length !== 3) return 0;
  const hours = parseFloat(parts[0]) || 0;
  const minutes = parseFloat(parts[1]) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats seconds into standard SRT timestamp HH:MM:SS,mmm
 */
export function formatSrtTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const ms = String(millis === 1000 ? 999 : millis).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * Compact MM:SS.ms display for timeline rulers and cue rows
 */
export function formatCompactTime(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe - Math.floor(safe)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(tenths).padStart(2, '0')}`;
}

/**
 * Parses an .srt text file into sorted SrtCue objects.
 */
export function parseSrtText(raw: string): SrtCue[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    let indexNum = cues.length + 1;

    if (/^\d+$/.test(lines[0])) {
      indexNum = parseInt(lines[0], 10);
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startRaw, endRawWithMeta] = timeLine.split('-->');
    const endRaw = endRawWithMeta.trim().split(/\s+/)[0];
    const startSec = parseSrtTimestamp(startRaw);
    const endSec = parseSrtTimestamp(endRaw);

    if (endSec <= startSec) continue;

    const textLines = lines.slice(timeLineIdx + 1);
    const cleanText = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

    cues.push({
      id: `cue-${indexNum}-${Math.round(startSec * 1000)}`,
      index: indexNum,
      startSec,
      endSec,
      text: cleanText || `Dialogue ${indexNum}`,
    });
  }

  return cues
    .sort((a, b) => a.startSec - b.startSec)
    .map((cue, idx) => ({ ...cue, index: idx + 1 }));
}

/**
 * Serializes SrtCue array back to valid .srt file contents.
 */
export function serializeSrt(cues: SrtCue[]): string {
  return cues
    .map((cue, idx) => {
      return `${idx + 1}\n${formatSrtTimestamp(cue.startSec)} --> ${formatSrtTimestamp(cue.endSec)}\n${cue.text}`;
    })
    .join('\n\n')
    .concat('\n');
}

/**
 * Computes all dialogue-free gaps across the movie timeline where Background Music plays at full gap volume.
 */
export function computeDialogueGaps(
  cues: Array<{ startSec: number; endSec: number; muted?: boolean; hasAudio?: boolean }>,
  totalDurationSec: number
): GapInterval[] {
  const activeCues = cues
    .filter((c) => !c.muted && c.hasAudio !== false && c.endSec > c.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const gaps: GapInterval[] = [];
  let cursor = 0;

  for (const cue of activeCues) {
    if (cue.startSec > cursor + 0.05) {
      gaps.push({
        id: `gap-${Math.round(cursor * 1000)}`,
        startSec: cursor,
        endSec: cue.startSec,
        durationSec: cue.startSec - cursor,
      });
    }
    if (cue.endSec > cursor) {
      cursor = cue.endSec;
    }
  }

  if (totalDurationSec > cursor + 0.05) {
    gaps.push({
      id: `gap-end-${Math.round(cursor * 1000)}`,
      startSec: cursor,
      endSec: totalDurationSec,
      durationSec: totalDurationSec - cursor,
    });
  }

  return gaps;
}
