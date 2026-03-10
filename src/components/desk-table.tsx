"use client";

import { useState, useMemo } from "react";
import type { DeskMetrics, DeskCategory } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";

interface DeskTableProps {
  desks: DeskMetrics[];
  onDeskClick?: (desk: DeskMetrics) => void;
}

type SortField = keyof Pick<
  DeskMetrics,
  "name" | "floor" | "neighborhood" | "workPointType" | "openClose" | "deskType" | "category" | "avg_minutes_per_day" | "avg_sessions_per_day"
>;

const PAGE_SIZE = 50;

export default function DeskTable({ desks, onDeskClick }: DeskTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return desks;
    const q = search.toLowerCase();
    return desks.filter((d) => d.name.toLowerCase().includes(q));
  }, [desks, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      let cmp: number;
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = (aVal as number) - (bVal as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageDesks = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (field !== sortField) return <span className="text-gray-300 ml-1">&#8597;</span>;
    return <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  function downloadCsv() {
    const headers = [
      "name", "floor", "neighborhood", "work_point_type", "open_close", "desk_type", "category",
      "avg_minutes_per_day", "avg_sessions_per_day", "avg_session_duration",
      "total_minutes", "total_sessions", "active_days",
    ];
    const rows = sorted.map((d) =>
      [
        d.name, d.floor, d.neighborhood, d.workPointType, d.openClose, d.deskType, d.category,
        d.avg_minutes_per_day, d.avg_sessions_per_day, d.avg_session_duration,
        d.total_minutes, d.total_sessions, d.active_days,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desk-behavior-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <input
            type="text"
            placeholder="Search desk name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-64"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {filtered.length} desk{filtered.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={downloadCsv}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {([
                ["name", "Desk Name"],
                ["floor", "Floor"],
                ["neighborhood", "Neighborhood"],
                ["category", "Category"],
                ["avg_minutes_per_day", "Avg Min/Day"],
                ["avg_sessions_per_day", "Sessions/Day"],
              ] as [SortField, string][]).map(([field, label]) => (
                <th
                  key={field}
                  className={`${field === "avg_minutes_per_day" || field === "avg_sessions_per_day" ? "text-right" : "text-left"} px-4 py-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900`}
                  onClick={() => handleSort(field)}
                >
                  {label} <SortIcon field={field} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageDesks.map((desk) => (
              <tr
                key={desk.space_id}
                className={`border-b border-gray-100 hover:bg-gray-50${onDeskClick ? " cursor-pointer" : ""}`}
                onClick={() => onDeskClick?.(desk)}
              >
                <td className="px-4 py-2 font-medium text-gray-900">{desk.name}</td>
                <td className="px-4 py-2 text-gray-600">{desk.floor}</td>
                <td className="px-4 py-2 text-gray-600">{desk.neighborhood}</td>
                <td className="px-4 py-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[desk.category]}20`,
                      color: CATEGORY_COLORS[desk.category],
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[desk.category] }}
                    />
                    {desk.category}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {desk.avg_minutes_per_day.toFixed(1)}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {desk.avg_sessions_per_day.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
