import { apiFetch } from "./http"

export interface NotificationTokenRequest {
  token: string
}

export async function registerToken(token: string): Promise<void> {
  await apiFetch<void>("/api/notification/register", {
    method: "POST",
    body: JSON.stringify({ token } satisfies NotificationTokenRequest),
  })
}

export async function unregisterToken(token: string): Promise<void> {
  await apiFetch<void>("/api/notification/unregister", {
    method: "POST",
    body: JSON.stringify({ token } satisfies NotificationTokenRequest),
  })
}
