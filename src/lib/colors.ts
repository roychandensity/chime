export const CHIME_COLORS = {
  meetingRoom: "#3b92fd",
  desk: "#34beab",
  openCollab: "#fca53a",
  notUsed: "#c1c6cd",
  pitStop: "#34beab",
  deepFocus: "#3b92fd",
  inAndOut: "#fca53a",
} as const;

export const GROUP_SIZE_COLORS: Record<string, string> = {
  "1": "#c7ddfb",
  "2": "#8bbbf8",
  "3-5": "#3b92fd",
  "6-9": "#1a6ad4",
  "10+": "#0d4a9b",
};

export const HEATMAP_SCALE = {
  low: "#e8f0fe",
  high: "#1a56db",
} as const;
