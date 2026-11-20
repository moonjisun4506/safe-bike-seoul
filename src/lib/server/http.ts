import "server-only";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(data: unknown, source: string, isDemo: boolean) {
  return Response.json({ data, meta: { source, isDemo, fetchedAt: new Date().toISOString() } }, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
export async function handle(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    // Never forward upstream bodies, exception messages, URLs, headers or credentials.
    const known = error instanceof ApiError;
    return Response.json({ error: {
      code: known ? error.code : "UPSTREAM_ERROR",
      message: known ? error.message : "외부 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    } }, { status: known ? error.status : 502, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
export function requireKey(key: string) {
  if (!key) throw new ApiError(503, "NOT_CONFIGURED", "외부 API 인증 설정이 필요합니다.");
  return key;
}
export function integer(params: URLSearchParams, name: string, fallback: number, min: number, max: number) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max)
    throw new ApiError(400, "INVALID_PARAMETER", `${name} 값이 허용 범위를 벗어났습니다.`);
  return Number(raw);
}
export async function fetchJson(url: URL, headers?: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
  if (response.status === 401 || response.status === 403) throw new ApiError(502, "API_ACCESS_DENIED", `외부 API 접근이 거부되었습니다(HTTP ${response.status}). 서버 인증키와 서비스 활용승인·접근 제한을 확인해 주세요.`);
  if (response.status === 429) throw new ApiError(503, "API_QUOTA_EXCEEDED", "외부 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
  if (!response.ok) throw new Error("Upstream failure");
  return response.json();
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid upstream object");
  return value as Record<string, unknown>;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid upstream list");
  return value;
}
export function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid upstream text");
  return value;
}
export function numeric(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isFinite(Number(value))) throw new Error("Invalid upstream number");
  return Number(value);
}

