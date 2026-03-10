import useSWRMutation from "swr/mutation";
import type { DayOfWeekSaturation, ChimeSpace } from "@/lib/types";

interface SaturationRequest {
  spaceType: string;
  spaces: ChimeSpace[];
  startDate: string;
  endDate: string;
  startHour?: number;
  endHour?: number;
}

async function fetchSaturation(
  url: string,
  { arg }: { arg: SaturationRequest }
): Promise<DayOfWeekSaturation[]> {
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
    throw new Error(errBody.error || "Failed to fetch saturation");
  }

  return res.json();
}

export function useSaturation(key: string) {
  const { data, error, isMutating, trigger } = useSWRMutation<
    DayOfWeekSaturation[],
    Error,
    string,
    SaturationRequest
  >(`/api/saturation?type=${key}`, fetchSaturation);

  return {
    data,
    error,
    isLoading: isMutating,
    analyze: trigger,
  };
}
