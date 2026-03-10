"use client";

import { useRef, useEffect } from "react";
import type { DeskMetrics, DeskSessionsResponse, DeskCategory } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import DownloadButton from "@/components/download-button";

interface DeskDetailDrawerProps {
  desk: DeskMetrics;
  data: DeskSessionsResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
  onClose: () => void;
}

function CategoryBadge({ category }: { category: DeskCategory }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${CATEGORY_COLORS[category]}20`,
        color: CATEGORY_COLORS[category],
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: CATEGORY_COLORS[category] }}
      />
      {category}
    </span>
  );
}

function formatHour(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function DeskDetailDrawer({
  desk,
  data,
  isLoading,
  error,
  onClose,
}: DeskDetailDrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  let minHour = 8;
  let maxHour = 18;
  if (data?.days) {
    for (const day of data.days) {
      for (const s of day.sessions) {
        if (s.startHour < minHour) minHour = Math.floor(s.startHour);
        if (s.endHour > maxHour) maxHour = Math.ceil(s.endHour);
      }
    }
  }
  const hourRange = maxHour - minHour;
  const hours = Array.from({ length: hourRange + 1 }, (_, i) => minHour + i);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[600px] max-w-full bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{desk.name}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>{desk.floor}</span>
              <span>&middot;</span>
              <span>{desk.neighborhood}</span>
            </div>
            {data?.summary && (
              <div className="mt-2">
                <CategoryBadge category={data.summary.category} />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">Loading desk sessions...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error.message}</p>
            </div>
          )}

          {data && (
            <div ref={contentRef} className="relative space-y-4 bg-white">
              <DownloadButton targetRef={contentRef} filename={`desk-${desk.name}-timeline`} />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Active Days</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {data.summary.activeDays} / {data.summary.totalDays}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Avg Min/Day</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {data.summary.avgMinutesPerDay}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total Sessions</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {data.summary.totalSessions}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Avg Sessions/Day</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {data.summary.avgSessionsPerDay}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Daily Timeline</h3>
                <div className="flex ml-[90px] mr-[60px] mb-1">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="text-[10px] text-gray-400"
                      style={{ width: `${100 / hourRange}%` }}
                    >
                      {h}
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {data.days.map((day) => (
                    <div key={day.date} className="flex items-center gap-0">
                      <div className="w-[90px] shrink-0 text-[11px] text-gray-500 truncate pr-2" title={day.dayLabel}>
                        {day.dayLabel}
                      </div>
                      <div className="flex-1 relative h-5 bg-gray-100 rounded-sm">
                        {day.sessions.map((session, i) => {
                          const left = ((session.startHour - minHour) / hourRange) * 100;
                          const width = ((session.endHour - session.startHour) / hourRange) * 100;
                          return (
                            <div
                              key={i}
                              className="absolute top-0 h-full rounded-sm cursor-default"
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(width, 0.5)}%`,
                                backgroundColor: CATEGORY_COLORS[day.category],
                              }}
                              title={`${formatHour(session.startHour)} - ${formatHour(session.endHour)} (${session.durationMinutes} min)`}
                            />
                          );
                        })}
                      </div>
                      <div className="w-[60px] shrink-0 text-right text-[11px] text-gray-500 pl-2">
                        {day.totalMinutes > 0 ? `${day.totalMinutes}m` : "\u2014"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
