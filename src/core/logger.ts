/** Structured, plain-text logging. No emojis/ASCII-art — tokens and grep-ability. */

export type LogLevel = "debug" | "info" | "warn" | "error";

const MARK: Record<LogLevel, string> = {
  debug: "[..]",
  info: "[OK]",
  warn: "[WARN]",
  error: "[ERROR]",
};

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
  child(scope: string): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  scope?: string;
  /** Sink override — tests capture lines here instead of writing to stderr. */
  sink?: (line: string) => void;
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level = opts.level ?? "info";
  const scope = opts.scope ?? "talaria";
  const sink = opts.sink ?? ((line: string) => process.stderr.write(line + "\n"));

  const emit = (lvl: LogLevel, msg: string, data?: unknown): void => {
    if (ORDER[lvl] < ORDER[level]) return;
    const suffix = data === undefined ? "" : " " + safeJson(data);
    sink(`${MARK[lvl]} ${scope}: ${msg}${suffix}`);
  };

  return {
    debug: (m, d) => emit("debug", m, d),
    info: (m, d) => emit("info", m, d),
    warn: (m, d) => emit("warn", m, d),
    error: (m, d) => emit("error", m, d),
    child: (s) => createLogger({ ...opts, scope: `${scope}:${s}` }),
  };
}

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
