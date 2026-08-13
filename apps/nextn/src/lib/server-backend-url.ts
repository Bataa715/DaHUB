/**
 * Backend base URL for Next.js Route Handlers / server-only fetch.
 * Prefer INTERNAL_* so Docker/dev containers don't hit container-local
 * `localhost` when the API runs on the host.
 */
export function getServerBackendUrl(): string | undefined {
  const url =
    process.env.INTERNAL_API_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL;
  return url?.replace(/\/$/, "") || undefined;
}
