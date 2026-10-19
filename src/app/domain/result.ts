export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(errors: string[]): Result<T> => ({ ok: false, errors });
