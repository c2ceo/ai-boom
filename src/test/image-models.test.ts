import { describe, it, expect } from "vitest";
import { imageCreditCost, SCHNELL_FREE_LIMIT } from "../../supabase/functions/_shared/image-models";
describe("image prices", () => {
  it("makes the first million Schnell images free", () => {
    expect(SCHNELL_FREE_LIMIT).toBe(1_000_000);
    expect(imageCreditCost("schnell", 0)).toBe(0);
    expect(imageCreditCost("schnell", 999_999)).toBe(0);
  });
  it("charges one credit after the shared million-image limit", () => {
    expect(imageCreditCost("schnell", 1_000_000)).toBe(1);
    expect(imageCreditCost("schnell", 1_000_001)).toBe(1);
  });
  it("charges five credits for Dev even during the promotion", () => {
    expect(imageCreditCost("dev", 0)).toBe(5);
    expect(imageCreditCost("dev", 1_000_000)).toBe(5);
  });
  it("charges eight credits for Pro even during the promotion", () => {
    expect(imageCreditCost("pro", 0)).toBe(8);
    expect(imageCreditCost("pro", 1_000_000)).toBe(8);
  });
});