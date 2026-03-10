"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { format, subWeeks } from "date-fns";
import type { ChimeFilters } from "@/lib/types";

const today = () => format(new Date(), "yyyy-MM-dd");
const thirtyDaysAgo = () => format(subWeeks(new Date(), 4), "yyyy-MM-dd");

const DEFAULT_FILTERS: ChimeFilters = {
  startDate: thirtyDaysAgo(),
  endDate: today(),
  floors: [],
  startHour: 8,
  endHour: 17,
  daysOfWeek: [1, 2, 3, 4, 5],
};

interface FilterContextType {
  filters: ChimeFilters;
  setFilters: (filters: ChimeFilters) => void;
  updateFilters: (partial: Partial<ChimeFilters>) => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<ChimeFilters>(DEFAULT_FILTERS);

  function updateFilters(partial: Partial<ChimeFilters>) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  return (
    <FilterContext.Provider value={{ filters, setFilters, updateFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextType {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
