import { describe, it, expect } from "vitest";
import { toPaise, toRupees, formatINR, formatINRCompact, roundupPaise } from "./money";

describe("money helpers", () => {
  it("converts rupees <-> paise", () => {
    expect(toPaise(100)).toBe(10000);
    expect(toPaise(20.36)).toBe(2036);
    expect(toRupees(10000)).toBe(100);
  });

  it("formats INR with Indian grouping", () => {
    expect(formatINR(4872036, { paise: true })).toBe("₹48,720.36");
    expect(formatINR(4872036)).toBe("₹48,720");
    expect(formatINR(-25000)).toBe("-₹250");
    expect(formatINR(25000, { sign: true })).toBe("+₹250");
  });

  it("formats compact amounts", () => {
    expect(formatINRCompact(toPaise(48720))).toBe("₹48.7K");
    expect(formatINRCompact(toPaise(150000))).toBe("₹1.50L");
    expect(formatINRCompact(toPaise(20000000))).toBe("₹2.00Cr");
  });

  it("computes roundup to the nearest ₹100", () => {
    expect(roundupPaise(toPaise(182), 100)).toBe(toPaise(18)); // 182 -> 200
    expect(roundupPaise(toPaise(350), 100)).toBe(toPaise(50)); // 350 -> 400
    expect(roundupPaise(toPaise(200), 100)).toBe(0); // already round
  });
});
