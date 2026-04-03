import { classifyDesk } from "../classify";
import { MOCK_DESKS } from "../mock-data";

/**
 * Classification rules (calibrated against Density desk_sessions_features):
 *   0 sessions            → Not Used
 *   avgSessionDuration≥90 → Deep Focus
 *   totalSessions≥3       → In and Out
 *   else                  → Pit Stop
 */
describe("classifyDesk", () => {
  for (const desk of MOCK_DESKS) {
    it(`classifies ${desk.name} as "${desk.expectedCategory}"`, () => {
      const result = classifyDesk(
        desk.totalSessions,
        desk.avgSessionsPerDay,
        desk.avgSessionDuration
      );
      expect(result).toBe(desk.expectedCategory);
    });
  }

  it("classifies zero sessions as Not Used", () => {
    expect(classifyDesk(0, 0, 0)).toBe("Not Used");
  });

  it("classifies avgSessionDuration >= 90 as Deep Focus", () => {
    expect(classifyDesk(1, 0.5, 90)).toBe("Deep Focus");
    expect(classifyDesk(1, 0.5, 91)).toBe("Deep Focus");
    expect(classifyDesk(5, 3.0, 120)).toBe("Deep Focus");
  });

  it("classifies >= 3 sessions with avg < 90 as In and Out", () => {
    expect(classifyDesk(3, 1.0, 25)).toBe("In and Out");
    expect(classifyDesk(5, 2.0, 50)).toBe("In and Out");
    expect(classifyDesk(10, 2.0, 50)).toBe("In and Out");
  });

  it("classifies 1-2 sessions with avg < 90 as Pit Stop", () => {
    expect(classifyDesk(1, 0.1, 10)).toBe("Pit Stop");
    expect(classifyDesk(1, 0.1, 14)).toBe("Pit Stop");
    expect(classifyDesk(1, 0.5, 50)).toBe("Pit Stop");
    expect(classifyDesk(2, 2.0, 31)).toBe("Pit Stop");
    expect(classifyDesk(2, 1.0, 89)).toBe("Pit Stop");
  });

  it("prioritizes Deep Focus over In and Out when both match", () => {
    // 5 sessions, avg 100 min → Deep Focus (duration check comes first)
    expect(classifyDesk(5, 2.5, 100)).toBe("Deep Focus");
  });
});
