import useSWRMutation from "swr/mutation";
import type { DeskSessionsResponse, DeskSessionsRequest } from "@/lib/types";

async function fetchDeskSessions(
  url: string,
  { arg }: { arg: DeskSessionsRequest }
): Promise<DeskSessionsResponse> {
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
    throw new Error(errBody.error || "Failed to fetch desk sessions");
  }

  return res.json();
}

export function useDeskSessions() {
  const { data, error, isMutating, trigger, reset } = useSWRMutation<
    DeskSessionsResponse,
    Error,
    string,
    DeskSessionsRequest
  >("/api/desk-sessions", fetchDeskSessions);

  return {
    data,
    error,
    isLoading: isMutating,
    fetch: trigger,
    reset,
  };
}
