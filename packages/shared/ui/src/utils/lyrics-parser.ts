/**
 * Multi-format Lyrics Parser
 *
 * Supports:
 * - Standard LRC: [mm:ss.xx]Text
 * - Enhanced LRC (ELRC): [mm:ss.xx]<mm:ss.xx>Word<mm:ss.xx>Word - syllable-level timing
 * - SRT: Standard subtitle format (00:00:00,000 --> 00:00:00,000)
 * - Plain text: No timestamps
 *
 * ELRC provides native word/syllable timing for the best karaoke experience
 */

import type { LyricLine, WordTiming, LineWithWords } from '../stores/lyrics-store';
import { calculateWordTimings, DEFAULT_TIMING_CONFIG } from './syllable-timing';

export type LyricsFormat = 'lrc' | 'elrc' | 'srt' | 'plain' | 'unknown';

export interface ParsedLyrics {
  format: LyricsFormat;
  lines: LyricLine[];
  linesWithWords: LineWithWords[];
  hasNativeWordTiming: boolean;
}

/**
 * Parse time from LRC format [mm:ss.xx] or [mm:ss.xxx]
 * Returns time in milliseconds
 */
function parseLRCTime(timeStr: string): number {
  const match = /(\d{2}):(\d{2})\.(\d{2,3})/.exec(timeStr);
  if (!match || !match[1] || !match[2] || !match[3]) return -1;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  let milliseconds = parseInt(match[3], 10);

  // Convert centiseconds to milliseconds if needed
  if (match[3].length === 2) {
    milliseconds *= 10;
  }

  return (minutes * 60 + seconds) * 1000 + milliseconds;
}

/**
 * Parse time from SRT format 00:00:00,000
 */
function parseSRTTime(timeStr: string): number {
  const match = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/.exec(timeStr);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) return -1;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
}

/**
 * Detect the format of lyrics content
 */
export function detectFormat(content: string): LyricsFormat {
  const lines = content.split('\n').slice(0, 20); // Check first 20 lines

  // Check for SRT format (numbered lines with --> arrows)
  if (lines.some(line => /^\d+$/.test(line.trim())) &&
      lines.some(line => line.includes('-->'))) {
    return 'srt';
  }

  // Check for ELRC format (inline word timestamps <mm:ss.xx>)
  if (lines.some(line => /<\d{2}:\d{2}\.\d{2,3}>/.test(line))) {
    return 'elrc';
  }

  // Check for standard LRC format [mm:ss.xx]
  if (lines.some(line => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(line))) {
    return 'lrc';
  }

  // Check for LRC metadata tags
  if (lines.some(line => /^\[(ar|ti|al|au|by|offset|length):/i.test(line))) {
    return 'lrc';
  }

  return 'plain';
}

/**
 * Parse Enhanced LRC (ELRC) format with word-level timestamps
 *
 * Format: [mm:ss.xx]<mm:ss.xx>Word<mm:ss.xx>Word<mm:ss.xx>Word
 * Each word is preceded by its start timestamp
 */
function parseELRC(content: string, trackDuration?: number): ParsedLyrics {
  const lines: LyricLine[] = [];
  const linesWithWords: LineWithWords[] = [];

  // Regex to match line timestamp and content
  const lineRegex = /^\[(\d{2}:\d{2}\.\d{2,3})\](.*)$/;
  // Regex to match word timestamps within a line
  const wordRegex = /<(\d{2}:\d{2}\.\d{2,3})>([^<]*)/g;

  const contentLines = content.split('\n');

  for (let i = 0; i < contentLines.length; i++) {
    const rawLine = contentLines[i];
    if (!rawLine) continue;

    const line = rawLine.trim();
    const lineMatch = lineRegex.exec(line);

    if (!lineMatch || !lineMatch[1] || !lineMatch[2]) continue;

    const lineTime = parseLRCTime(lineMatch[1]);
    const lineContent = lineMatch[2];

    // Check if this line has word-level timestamps
    const hasWordTimings = /<\d{2}:\d{2}\.\d{2,3}>/.test(lineContent);

    if (hasWordTimings) {
      // Parse word-level timestamps
      const words: WordTiming[] = [];
      let plainText = '';
      let match: RegExpExecArray | null;
      let wordIndex = 0;

      // Reset regex
      wordRegex.lastIndex = 0;

      while ((match = wordRegex.exec(lineContent)) !== null) {
        if (!match[1] || !match[2]) continue;

        const wordStartTime = parseLRCTime(match[1]);
        const wordText = match[2].trim();

        if (wordText) {
          plainText += (plainText ? ' ' : '') + wordText;

          // Find next word's start time for end time, or estimate
          const nextMatch = wordRegex.exec(lineContent);
          let wordEndTime: number;

          if (nextMatch && nextMatch[1]) {
            wordEndTime = parseLRCTime(nextMatch[1]);
            // Reset to re-process next match
            wordRegex.lastIndex = match.index + match[0].length;
          } else {
            // Last word in line - estimate end time
            const nextLine = contentLines.slice(i + 1).find(l => l && lineRegex.test(l.trim()));
            if (nextLine) {
              const nextLineMatch = lineRegex.exec(nextLine.trim());
              if (nextLineMatch && nextLineMatch[1]) {
                wordEndTime = parseLRCTime(nextLineMatch[1]);
              } else {
                wordEndTime = wordStartTime + 1000; // Default 1 second
              }
            } else {
              wordEndTime = trackDuration ? trackDuration : wordStartTime + 1000;
            }
          }

          words.push({
            word: wordText,
            startTime: wordStartTime,
            endTime: wordEndTime,
            lineIndex: lines.length,
            wordIndex: wordIndex++
          });
        }
      }

      lines.push({ time: lineTime, text: plainText });
      linesWithWords.push({ time: lineTime, text: plainText, words });
    } else {
      // No word-level timing, just line timing
      // Strip any remaining tags and clean up
      const plainText = lineContent.replace(/<[^>]+>/g, '').trim();
      lines.push({ time: lineTime, text: plainText });

      // Will need to interpolate word timings
      linesWithWords.push({ time: lineTime, text: plainText, words: [] });
    }
  }

  // Sort by time
  lines.sort((a, b) => a.time - b.time);
  linesWithWords.sort((a, b) => a.time - b.time);

  // Fill in missing word timings using interpolation
  for (let i = 0; i < linesWithWords.length; i++) {
    const line = linesWithWords[i];
    if (!line) continue;

    if (line.words.length === 0 && line.text.trim()) {
      const nextLine = linesWithWords[i + 1];
      const nextLineTime = nextLine ? nextLine.time : (trackDuration || line.time + 5000);
      const lineDuration = Math.min(nextLineTime - line.time, 10000);

      const timedWords = calculateWordTimings(line.text, line.time, lineDuration, DEFAULT_TIMING_CONFIG);
      line.words = timedWords.map((tw, idx) => ({
        word: tw.word,
        startTime: tw.startTime,
        endTime: tw.endTime,
        lineIndex: i,
        wordIndex: idx
      }));
    }
  }

  return {
    format: 'elrc',
    lines,
    linesWithWords,
    hasNativeWordTiming: true
  };
}

/**
 * Parse standard LRC format
 */
function parseLRC(content: string, trackDuration?: number): ParsedLyrics {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

  for (const line of content.split('\n')) {
    const match = regex.exec(line.trim());
    if (match && match[1] && match[2] && match[3]) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let centiseconds = parseInt(match[3], 10);
      if (match[3].length === 2) {
        centiseconds *= 10;
      }
      const text = match[4]?.trim() ?? '';
      const time = (minutes * 60 + seconds) * 1000 + centiseconds;
      lines.push({ time, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);

  // Generate word timings using syllable-based interpolation
  const linesWithWords: LineWithWords[] = lines.map((line, index) => {
    const nextLine = lines[index + 1];
    const nextLineTime = nextLine ? nextLine.time : (trackDuration || line.time + 5000);
    const lineDuration = Math.min(nextLineTime - line.time, 10000);

    if (!line.text.trim()) {
      return { ...line, words: [] };
    }

    const timedWords = calculateWordTimings(line.text, line.time, lineDuration, DEFAULT_TIMING_CONFIG);
    return {
      ...line,
      words: timedWords.map((tw, idx) => ({
        word: tw.word,
        startTime: tw.startTime,
        endTime: tw.endTime,
        lineIndex: index,
        wordIndex: idx
      }))
    };
  });

  return {
    format: 'lrc',
    lines,
    linesWithWords,
    hasNativeWordTiming: false
  };
}

/**
 * Parse SRT subtitle format
 */
function parseSRT(content: string, trackDuration?: number): ParsedLyrics {
  const lines: LyricLine[] = [];
  const blocks = content.split(/\n\s*\n/); // Split by blank lines

  for (const block of blocks) {
    const blockLines = block.trim().split('\n');
    if (blockLines.length < 2) continue;

    // Find the timing line (contains -->)
    const timingLineIndex = blockLines.findIndex(l => l.includes('-->'));
    if (timingLineIndex === -1) continue;

    const timingLine = blockLines[timingLineIndex];
    if (!timingLine) continue;

    const timingMatch = /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/.exec(timingLine);
    if (!timingMatch || !timingMatch[1] || !timingMatch[2]) continue;

    const startTime = parseSRTTime(timingMatch[1]);

    // Get text lines (everything after timing)
    const textLines = blockLines.slice(timingLineIndex + 1);
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\{[^}]+\}/g, '') // Remove ASS style tags
      .trim();

    if (text) {
      lines.push({ time: startTime, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);

  // Generate word timings
  const linesWithWords: LineWithWords[] = lines.map((line, index) => {
    const nextLine = lines[index + 1];
    const nextLineTime = nextLine ? nextLine.time : (trackDuration || line.time + 5000);
    const lineDuration = Math.min(nextLineTime - line.time, 10000);

    if (!line.text.trim()) {
      return { ...line, words: [] };
    }

    const timedWords = calculateWordTimings(line.text, line.time, lineDuration, DEFAULT_TIMING_CONFIG);
    return {
      ...line,
      words: timedWords.map((tw, idx) => ({
        word: tw.word,
        startTime: tw.startTime,
        endTime: tw.endTime,
        lineIndex: index,
        wordIndex: idx
      }))
    };
  });

  return {
    format: 'srt',
    lines,
    linesWithWords,
    hasNativeWordTiming: false
  };
}

/**
 * Parse plain text lyrics (no timestamps)
 * Creates evenly spaced lines for basic display
 */
function parsePlainText(content: string): ParsedLyrics {
  const textLines = content.split('\n').filter(l => l.trim());

  // No timing available
  const lines: LyricLine[] = textLines.map((text) => ({
    time: -1, // No timing
    text: text.trim()
  }));

  return {
    format: 'plain',
    lines,
    linesWithWords: lines.map(l => ({ ...l, words: [] })),
    hasNativeWordTiming: false
  };
}

/**
 * Parse lyrics content, auto-detecting format
 */
export function parseLyrics(content: string, trackDuration?: number): ParsedLyrics {
  if (!content || !content.trim()) {
    return {
      format: 'unknown',
      lines: [],
      linesWithWords: [],
      hasNativeWordTiming: false
    };
  }

  const format = detectFormat(content);

  switch (format) {
    case 'elrc':
      return parseELRC(content, trackDuration);
    case 'lrc':
      return parseLRC(content, trackDuration);
    case 'srt':
      return parseSRT(content, trackDuration);
    case 'plain':
    default:
      return parsePlainText(content);
  }
}

/**
 * Convert lyrics to a specific format for export
 */
export function convertToLRC(lyrics: LyricLine[]): string {
  return lyrics
    .filter(line => line.time >= 0)
    .map(line => {
      const totalSeconds = Math.floor(line.time / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const centiseconds = Math.floor((line.time % 1000) / 10);

      return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]${line.text}`;
    })
    .join('\n');
}

/**
 * Convert lyrics with word timings to ELRC format
 */
export function convertToELRC(linesWithWords: LineWithWords[]): string {
  return linesWithWords
    .filter(line => line.time >= 0)
    .map(line => {
      const totalSeconds = Math.floor(line.time / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const centiseconds = Math.floor((line.time % 1000) / 10);

      const lineTimestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]`;

      if (line.words.length === 0) {
        return lineTimestamp + line.text;
      }

      const wordParts = line.words.map(word => {
        const wSeconds = Math.floor(word.startTime / 1000);
        const wMinutes = Math.floor(wSeconds / 60);
        const wSecs = wSeconds % 60;
        const wCentis = Math.floor((word.startTime % 1000) / 10);

        return `<${wMinutes.toString().padStart(2, '0')}:${wSecs.toString().padStart(2, '0')}.${wCentis.toString().padStart(2, '0')}>${word.word}`;
      });

      return lineTimestamp + wordParts.join('');
    })
    .join('\n');
}
