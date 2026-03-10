import type { DeskCategory } from "./types";

export interface MockDesk {
  id: string;
  name: string;
  floor: string;
  team: string;
  neighborhood: string;
  totalSessions: number;
  avgSessionDuration: number;
  avgSessionsPerDay: number;
  expectedCategory: DeskCategory;
}

export const MOCK_DESKS: MockDesk[] = [
  // Not Used: zero sessions
  {
    id: "desk-a",
    name: "Desk-A",
    floor: "Floor 1",
    team: "Engineering",
    neighborhood: "Zone A",
    totalSessions: 0,
    avgSessionDuration: 0,
    avgSessionsPerDay: 0,
    expectedCategory: "Not Used",
  },
  // Deep Focus: avg session > 90 min
  {
    id: "desk-b",
    name: "Desk-B",
    floor: "Floor 1",
    team: "Design",
    neighborhood: "Zone A",
    totalSessions: 3,
    avgSessionDuration: 95,
    avgSessionsPerDay: 0.5,
    expectedCategory: "Deep Focus",
  },
  {
    id: "desk-c",
    name: "Desk-C",
    floor: "Floor 2",
    team: "Engineering",
    neighborhood: "Zone B",
    totalSessions: 10,
    avgSessionDuration: 120,
    avgSessionsPerDay: 1.7,
    expectedCategory: "Deep Focus",
  },
  // Pit Stop: falls through (1 session, avg between 15-90)
  {
    id: "desk-d",
    name: "Desk-D",
    floor: "Floor 2",
    team: "Marketing",
    neighborhood: "Zone B",
    totalSessions: 1,
    avgSessionDuration: 20,
    avgSessionsPerDay: 0.8,
    expectedCategory: "Pit Stop",
  },
  // Pit Stop: >= 2 sessions but avg <= 30
  {
    id: "desk-e",
    name: "Desk-E",
    floor: "Floor 3",
    team: "Sales",
    neighborhood: "No Neighborhood",
    totalSessions: 8,
    avgSessionDuration: 25,
    avgSessionsPerDay: 1.3,
    expectedCategory: "Pit Stop",
  },
  // In and Out: >= 2 sessions AND avg > 30
  {
    id: "desk-f",
    name: "Desk-F",
    floor: "Floor 3",
    team: "Engineering",
    neighborhood: "Zone C",
    totalSessions: 20,
    avgSessionDuration: 40,
    avgSessionsPerDay: 3.3,
    expectedCategory: "In and Out",
  },
  {
    id: "desk-g",
    name: "Desk-G",
    floor: "Floor 1",
    team: "Sales",
    neighborhood: "Zone A",
    totalSessions: 30,
    avgSessionDuration: 35,
    avgSessionsPerDay: 5,
    expectedCategory: "In and Out",
  },
  // Edge: 2 sessions, avg 31 -> In and Out (just above 30 threshold)
  {
    id: "desk-edge-1",
    name: "Desk-Edge-1",
    floor: "Floor 1",
    team: "Engineering",
    neighborhood: "Zone A",
    totalSessions: 2,
    avgSessionDuration: 31,
    avgSessionsPerDay: 2.0,
    expectedCategory: "In and Out",
  },
  // Edge: 2 sessions, avg 30 -> Pit Stop (not > 30)
  {
    id: "desk-edge-2",
    name: "Desk-Edge-2",
    floor: "Floor 2",
    team: "Design",
    neighborhood: "Zone B",
    totalSessions: 2,
    avgSessionDuration: 30,
    avgSessionsPerDay: 1.99,
    expectedCategory: "Pit Stop",
  },
  // Edge: 1 session, avg 91 -> Deep Focus (> 90 takes priority)
  {
    id: "desk-edge-3",
    name: "Desk-Edge-3",
    floor: "Floor 3",
    team: "Marketing",
    neighborhood: "Zone C",
    totalSessions: 1,
    avgSessionDuration: 91,
    avgSessionsPerDay: 0.1,
    expectedCategory: "Deep Focus",
  },
  // Edge: 1 session, avg 14 -> Not Used (low usage)
  {
    id: "desk-edge-4",
    name: "Desk-Edge-4",
    floor: "Floor 1",
    team: "Sales",
    neighborhood: "Zone A",
    totalSessions: 1,
    avgSessionDuration: 14,
    avgSessionsPerDay: 0.1,
    expectedCategory: "Not Used",
  },
  // Edge: 1 session, avg 15 -> Pit Stop (not < 15, falls through)
  {
    id: "desk-edge-5",
    name: "Desk-Edge-5",
    floor: "Floor 2",
    team: "Engineering",
    neighborhood: "Zone B",
    totalSessions: 1,
    avgSessionDuration: 15,
    avgSessionsPerDay: 0.1,
    expectedCategory: "Pit Stop",
  },
];
