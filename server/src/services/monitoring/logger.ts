import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_COLORS: Record<LogLevel, string> = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private level: LogLevel;
  private logFile: string;
  private maxLogFileSize: number = 50 * 1024 * 1024; // 50MB

  constructor() {
    this.logFile = path.join(__dirname, '../../../logs/app.log');

    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const envLevel = (process.env['LOG_LEVEL'] || 'info').toLowerCase() as LogLevel;
    this.level = ['debug', 'info', 'warn', 'error'].includes(envLevel) ? envLevel : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, source?: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = this.formatTimestamp();
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp, level, message, source, data,
    };

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const color = LEVEL_COLORS[level];
    const tag = source ? `[${source}] ` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    const line = `${color}[${timestamp}] [${level.toUpperCase()}] ${tag}${message}${dataStr}${RESET}`;
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    // File output (async, non-blocking)
    this.writeToFile(`[${timestamp}] [${level.toUpperCase()}] ${tag}${message}${dataStr}\n`);
  }

  private writeToFile(line: string): void {
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogFileSize) {
          const rotated = this.logFile.replace('.log', `.${Date.now()}.log`);
          fs.renameSync(this.logFile, rotated);
        }
      }
      fs.appendFileSync(this.logFile, line);
    } catch (_e) {
      // Silent fail for file logging
    }
  }

  debug(message: string, source?: string, data?: any): void { this.log('debug', message, source, data); }
  info(message: string, source?: string, data?: any): void { this.log('info', message, source, data); }
  warn(message: string, source?: string, data?: any): void { this.log('warn', message, source, data); }
  error(message: string, source?: string, data?: any): void { this.log('error', message, source, data); }

  getRecentLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter(l => LEVEL_ORDER[l.level] >= LEVEL_ORDER[level]);
    }
    return filtered.slice(-limit);
  }
}

const logger = new Logger();
export default logger;
