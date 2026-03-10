import useSWRMutation from "swr/mutation";
import type { SessionsResponse, SessionsRequest } from "@/lib/types";

async function fetchSessions(
  url: string,
  { arg }: { arg: SessionsRequest }
): Promise<SessionsResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || "Failed to fetch sessions");
  }

  return res.json();
}

export function useSessions() {
  const { data, error, isMutating, trigger } = useSWRMutation<
    SessionsResponse,
    Error,
    string,
    SessionsRequest
  >("/api/sessions", fetchSessions);

  return {
    data,
    error,
    isLoading: isMutating,
    analyze: trigger,
  };
}
