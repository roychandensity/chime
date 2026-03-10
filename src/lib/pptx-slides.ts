import type PptxGenJS from "pptxgenjs";
import type {
  DayOfWeekSaturation,
  AvailabilityHeatmapData,
  GroupSizeChartData,
  CategorySummary,
  GroupSummary,
} from "./types";
import { CHIME_COLORS, GROUP_SIZE_COLORS } from "./colors";

const TITLE_OPTS = { x: 0.5, y: 0.3, w: 8, h: 0.5, fontSize: 18, bold: true, color: "333333" } as const;
const SUBTITLE_OPTS = { x: 0.5, y: 0.8, w: 8, h: 0.4, fontSize: 11, color: "666666" } as const;

export function buildSaturationSlide(
  pptx: PptxGenJS,
  title: string,
  meetingRoomData?: DayOfWeekSaturation[],
  deskData?: DayOfWeekSaturation[],
  openCollabData?: DayOfWeekSaturation[]
) {
  const slide = pptx.addSlide();
  slide.addText(title, TITLE_OPTS);

  const data = meetingRoomData ?? deskData ?? openCollabData ?? [];
  if (data.length === 0) return;

  // Build chart data for each day
  const chartW = 1.6;
  const startX = 0.5;
  const chartY = 1.5;

  data.forEach((day, idx) => {
    const x = startX + idx * (chartW + 0.2);

    slide.addText(day.dayLabel, {
      x, y: chartY - 0.3, w: chartW, h: 0.3, fontSize: 9, bold: true, align: "center", color: "555555",
    });

    // Build line chart data points
    const chartData: { name: string; labels: string[]; values: number[] }[] = [];

    if (meetingRoomData) {
      chartData.push({
        name: "Meeting Rooms",
        labels: day.series.map((p) => `${p.hour}`),
        values: meetingRoomData[idx].series.map((p) => p.saturationPercent),
      });
    }
    if (deskData) {
      chartData.push({
        name: "Desks",
        labels: day.series.map((p) => `${p.hour}`),
        values: deskData[idx].series.map((p) => p.saturationPercent),
      });
    }
    if (openCollabData) {
      chartData.push({
        name: "Open Collab",
        labels: day.series.map((p) => `${p.hour}`),
        values: openCollabData[idx].series.map((p) => p.saturationPercent),
      });
    }

    if (chartData.length > 0) {
      slide.addChart(pptx.ChartType.line, chartData, {
        x, y: chartY, w: chartW, h: 2.5,
        showLegend: idx === 0,
        legendPos: "b",
        legendFontSize: 7,
        valAxisMaxVal: 100,
        valAxisMinVal: 0,
        catAxisLabelFontSize: 7,
        valAxisLabelFontSize: 7,
        lineSize: 2,
        chartColors: [CHIME_COLORS.meetingRoom.replace("#", ""), CHIME_COLORS.desk.replace("#", ""), CHIME_COLORS.openCollab.replace("#", "")],
      });
    }
  });
}

export function buildAvailabilitySlide(
  pptx: PptxGenJS,
  data: AvailabilityHeatmapData
) {
  const slide = pptx.addSlide();
  slide.addText("Meeting Room Availability", TITLE_OPTS);
  slide.addText("Available / Total rooms during peak hours", SUBTITLE_OPTS);

  if (data.floors.length === 0) return;

  const rows: PptxGenJS.TableRow[] = [];

  // Header row
  const headerCells: PptxGenJS.TableCell[] = [
    { text: "Floor", options: { bold: true, fontSize: 9, fill: { color: "F3F4F6" } } },
    ...data.daysOfWeek.map((d) => ({
      text: d.dayLabel,
      options: { bold: true, fontSize: 9, fill: { color: "F3F4F6" }, align: "center" as const },
    })),
  ];
  rows.push(headerCells);

  // Data rows
  for (const floor of data.floors) {
    const cells: PptxGenJS.TableCell[] = [
      { text: floor, options: { fontSize: 8 } },
    ];
    for (const dow of data.daysOfWeek) {
      const cell = data.matrix[floor]?.[dow.dayOfWeek];
      const text = cell ? `${cell.available} / ${cell.total}` : "-";
      cells.push({
        text,
        options: { fontSize: 8, align: "center" },
      });
    }
    rows.push(cells);
  }

  slide.addTable(rows, {
    x: 0.5, y: 1.3, w: 9,
    border: { pt: 0.5, color: "E5E7EB" },
    colW: [2, ...data.daysOfWeek.map(() => 1.2)],
  });
}

export function buildGroupSizeSlide(
  pptx: PptxGenJS,
  data: GroupSizeChartData
) {
  const slide = pptx.addSlide();
  slide.addText("Meeting Room Group Size", TITLE_OPTS);

  const labels = [data.overall, ...data.byFloor].map((d) => d.label);
  const buckets = ["1", "2", "3-5", "6-9", "10+"] as const;

  const chartData = buckets.map((bucket) => ({
    name: bucket === "1" ? "1 person" : bucket === "2" ? "2 people" : `${bucket} people`,
    labels,
    values: [data.overall, ...data.byFloor].map((d) => d.buckets[bucket]),
  }));

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5, y: 1.3, w: 9, h: 4.5,
    barDir: "bar",
    barGrouping: "stacked",
    showLegend: true,
    legendPos: "b",
    legendFontSize: 8,
    valAxisMaxVal: 100,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    chartColors: buckets.map((b) => GROUP_SIZE_COLORS[b].replace("#", "")),
  });
}

export function buildDeskOverviewSlide(
  pptx: PptxGenJS,
  summary: CategorySummary
) {
  const slide = pptx.addSlide();
  slide.addText("Desk Usage Overview", TITLE_OPTS);

  const total = summary["Not Used"] + summary["Pit Stop"] + summary["In and Out"] + summary["Deep Focus"];
  if (total === 0) return;

  const categories = ["Not Used", "Pit Stop", "In and Out", "Deep Focus"] as const;
  const colors = ["c1c6cd", "34beab", "fca53a", "3b92fd"];

  const chartData = [{
    name: "Desks",
    labels: categories.map(String),
    values: categories.map((c) => Math.round((summary[c] / total) * 100)),
  }];

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5, y: 1.3, w: 9, h: 2,
    barDir: "bar",
    barGrouping: "stacked",
    showLegend: true,
    legendPos: "b",
    legendFontSize: 8,
    valAxisMaxVal: 100,
    chartColors: colors,
  });
}

export function buildDeskByFloorSlide(
  pptx: PptxGenJS,
  floorSummary: GroupSummary
) {
  const slide = pptx.addSlide();
  slide.addText("Desk Usage by Floor", TITLE_OPTS);

  const floors = Object.keys(floorSummary).sort();
  const categories = ["Not Used", "Pit Stop", "In and Out", "Deep Focus"] as const;
  const colors = ["c1c6cd", "34beab", "fca53a", "3b92fd"];

  const chartData = categories.map((cat) => ({
    name: cat,
    labels: floors,
    values: floors.map((f) => {
      const fs = floorSummary[f];
      const total = fs["Not Used"] + fs["Pit Stop"] + fs["In and Out"] + fs["Deep Focus"];
      return total > 0 ? Math.round((fs[cat] / total) * 100) : 0;
    }),
  }));

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5, y: 1.3, w: 9, h: 4.5,
    barDir: "bar",
    barGrouping: "stacked",
    showLegend: true,
    legendPos: "b",
    legendFontSize: 8,
    valAxisMaxVal: 100,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    chartColors: colors,
  });
}

export function buildDeskByNeighborhoodSlide(
  pptx: PptxGenJS,
  neighborhoodSummary: GroupSummary
) {
  const slide = pptx.addSlide();
  slide.addText("Desk Usage by Neighborhood", TITLE_OPTS);

  const neighborhoods = Object.keys(neighborhoodSummary).sort();
  const categories = ["Not Used", "Pit Stop", "In and Out", "Deep Focus"] as const;
  const colors = ["c1c6cd", "34beab", "fca53a", "3b92fd"];

  const chartData = categories.map((cat) => ({
    name: cat,
    labels: neighborhoods,
    values: neighborhoods.map((n) => {
      const ns = neighborhoodSummary[n];
      const total = ns["Not Used"] + ns["Pit Stop"] + ns["In and Out"] + ns["Deep Focus"];
      return total > 0 ? Math.round((ns[cat] / total) * 100) : 0;
    }),
  }));

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5, y: 1.3, w: 9, h: 4.5,
    barDir: "bar",
    barGrouping: "stacked",
    showLegend: true,
    legendPos: "b",
    legendFontSize: 8,
    valAxisMaxVal: 100,
    catAxisLabelFontSize: 7,
    valAxisLabelFontSize: 8,
    chartColors: colors,
  });
}
