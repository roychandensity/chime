import useSWR from "swr";
import type { ChimeSpacesResponse } from "@/lib/types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error("Failed to fetch spaces");
    return res.json() as Promise<ChimeSpacesResponse>;
  });

export function useSpaces() {
  const { data, error, isLoading } = useSWR<ChimeSpacesResponse>("/api/spaces", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  });

  return {
    spaces: data?.spaces ?? [],
    allSpaces: data?.allSpaces ?? [],
    spacesByFunction: data?.spacesByFunction ?? { desk: [], meeting_room: [], open_collab: [], other: [] },
    floors: data?.floors ?? [],
    neighborhoods: data?.neighborhoods ?? [],
    workPointTypes: data?.workPointTypes ?? [],
    openCloseTypes: data?.openCloseTypes ?? [],
    deskTypes: data?.deskTypes ?? [],
    isLoading,
    error,
  };
}
