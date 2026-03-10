import useSWRMutation from "swr/mutation";
import type { GroupSizeChartData, ChimeSpace } from "@/lib/types";

interface GroupSizeRequest {
  spaces: ChimeSpace[];
  startDate: string;
  endDate: string;
}

async function fetchGroupSize(
  url: string,
  { arg }: { arg: GroupSizeRequest }
): Promise<GroupSizeChartData> {
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
    throw new Error(errBody.error || "Failed to fetch group size");
  }

  return res.json();
}

export function useGroupSize() {
  const { data, error, isMutating, trigger } = useSWRMutation<
    GroupSizeChartData,
    Error,
    string,
    GroupSizeRequest
  >("/api/group-size", fetchGroupSize);

  return {
    data,
    error,
    isLoading: isMutating,
    analyze: trigger,
  };
}
