"use client";

import { useState, useRef, useEffect } from "react";
import { useFilters } from "@/contexts/filter-context";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MultiSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allSelected = selected.length === 0;

  function toggleAll() {
    onChange([]);
  }

  function toggleOption(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      const next = [...selected, opt];
      if (next.length === options.length) {
        onChange([]);
      } else {
        onChange(next);
      }
    }
  }

  const buttonLabel = allSelected
    ? allLabel
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-left min-w-[140px] flex items-center justify-between gap-2 bg-white"
      >
        <span className="truncate">{buttonLabel}</span>
        <svg className="w-3 h-3 shrink-0 text-gray-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto min-w-[180px]">
          <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-gray-300"
            />
            <span className="font-medium">{allLabel}</span>
          </label>
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={allSelected || selected.includes(opt)}
                onChange={() => toggleOption(opt)}
                className="rounded border-gray-300"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChimeFilterPanelProps {
  floors: string[];
  onAnalyze: () => void;
  isLoading: boolean;
}

export default function ChimeFilterPanel({
  floors,
  onAnalyze,
  isLoading,
}: ChimeFilterPanelProps) {
  const { filters, updateFilters } = useFilters();

  function toggleDay(day: number) {
    const next = filters.daysOfWeek.includes(day)
      ? filters.daysOfWeek.filter((d) => d !== day)
      : [...filters.daysOfWeek, day].sort();
    updateFilters({ daysOfWeek: next });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap items-end gap-4">
        <MultiSelect
          label="Floor"
          allLabel="All Floors"
          options={floors}
          selected={filters.floors}
          onChange={(floors) => updateFilters({ floors })}
        />

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilters({ startDate: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilters({ endDate: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
          <div className="flex items-center gap-1">
            <select
              value={filters.startHour}
              onChange={(e) => updateFilters({ startHour: Number(e.target.value) })}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
            <span className="text-gray-500 text-sm">to</span>
            <select
              value={filters.endHour}
              onChange={(e) => updateFilters({ endHour: Number(e.target.value) })}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
          <div className="flex gap-1">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className={`px-2 py-1 text-xs rounded-md border ${
                  filters.daysOfWeek.includes(idx)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onAnalyze}
          disabled={isLoading || filters.daysOfWeek.length === 0}
          className="rounded-md bg-blue-600 px-6 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </button>
      </div>
    </div>
  );
}
