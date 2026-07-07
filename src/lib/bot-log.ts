const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const current = LEVELS[(process.env.BOT_LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;

function enabled(level: Level): boolean {
  return LEVELS[level] <= current;
}

export const botLog = {
  error: (...args: unknown[]) => enabled("error") && console.error("[bot]", ...args),
  warn: (...args: unknown[]) => enabled("warn") && console.warn("[bot]", ...args),
  info: (...args: unknown[]) => enabled("info") && console.log("[bot]", ...args),
  debug: (...args: unknown[]) => enabled("debug") && console.log("[bot]", ...args),
};

export function disconnectSummary(error: unknown): string {
  const err = error as {
    data?: { code?: string; hostname?: string; reason?: string };
    output?: { statusCode?: number; payload?: { message?: string } };
  };
  const code = err?.output?.statusCode;
  const msg =
    err?.output?.payload?.message ??
    err?.data?.code ??
    err?.data?.hostname ??
    err?.data?.reason ??
    "desconocido";
  return `code=${code ?? "?"} ${msg}`;
}
