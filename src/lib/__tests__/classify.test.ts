import { classifyDesk } from "../classify";
import { MOCK_DESKS } from "../mock-data";

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

  it("classifies avgSessionDuration > 90 as Deep Focus", () => {
    expect(classifyDesk(1, 0.5, 91)).toBe("Deep Focus");
    expect(classifyDesk(5, 3.0, 120)).toBe("Deep Focus");
  });

  it("classifies >= 2 sessions with avg > 30 as In and Out", () => {
    expect(classifyDesk(2, 2.0, 31)).toBe("In and Out");
    expect(classifyDesk(10, 2.0, 50)).toBe("In and Out");
  });

  it("classifies <= 1 session with avg < 15 as Not Used", () => {
    expect(classifyDesk(1, 0.1, 10)).toBe("Not Used");
    expect(classifyDesk(1, 0.1, 14)).toBe("Not Used");
  });

  it("classifies remaining cases as Pit Stop", () => {
    expect(classifyDesk(1, 0.5, 50)).toBe("Pit Stop");
    expect(classifyDesk(3, 1.0, 25)).toBe("Pit Stop");
    expect(classifyDesk(1, 0.1, 15)).toBe("Pit Stop");
  });
});
