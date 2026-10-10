import { afterEach, describe, expect, it } from "vitest";
import {
  getMonthGrid,
  localDateKey,
  localDateTimeToIso,
  startOfLocalDay,
  toLocalDateTimeInput,
} from "./localDateTime";

describe("local date and time helpers", () => {
  const originalTimeZone = process.env.TZ;

  afterEach(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("round-trips local date-time inputs as instants and formats them back in local time", () => {
    const instant = localDateTimeToIso("2026-02-28T23:45");
    expect(toLocalDateTimeInput(instant)).toBe("2026-02-28T23:45");
  });

  it("rejects invalid and non-existent daylight-saving local times", () => {
    process.env.TZ = "America/New_York";

    expect(() => localDateTimeToIso("not-a-date")).toThrow("Choose a valid planned start date and time.");
    expect(() => localDateTimeToIso("2026-03-08T02:30")).toThrow("local time does not exist");
    expect(localDateTimeToIso("2026-03-08T03:30")).toBe("2026-03-08T07:30:00.000Z");
  });

  it("uses local calendar boundaries across month/year changes", () => {
    const januaryGrid = getMonthGrid(new Date(2026, 0, 1));
    expect(januaryGrid).toHaveLength(42);
    expect(januaryGrid[0]).toEqual(new Date(2025, 11, 29));
    expect(januaryGrid[41]).toEqual(new Date(2026, 1, 8));
    expect(localDateKey(startOfLocalDay(new Date(2025, 11, 31, 23, 59)))).toBe("2025-12-31");
  });

  it("round-trips the earlier occurrence of an ambiguous fall-back time", () => {
    process.env.TZ = "America/New_York";

    const instant = localDateTimeToIso("2026-11-01T01:30");
    expect(instant).toBe("2026-11-01T05:30:00.000Z");
    expect(toLocalDateTimeInput(instant)).toBe("2026-11-01T01:30");
  });
});
