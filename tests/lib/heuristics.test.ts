import { describe, expect, test } from "vitest";
import { detectTyposquat } from "@/lib/scan/crawler/heuristics";

describe("detectTyposquat", () => {
  test("flags typo of paypal as paypa1", () => {
    const r = detectTyposquat("paypa1.com");
    expect(r.isLikelyTyposquat).toBe(true);
    expect(r.closestBrand).toBe("paypal");
  });

  test("flags suffix-based variant of moov", () => {
    const r = detectTyposquat("moov-bj-cashback.net");
    expect(r.isLikelyTyposquat).toBe(true);
    expect(r.closestBrand).toBe("moov");
  });

  test("flags suffix-based variant of mtn", () => {
    const r = detectTyposquat("mtn-bj-promo.online");
    expect(r.isLikelyTyposquat).toBe(true);
  });

  test("does not flag the legitimate brand itself", () => {
    expect(detectTyposquat("google.com").isLikelyTyposquat).toBe(false);
    expect(detectTyposquat("paypal.com").isLikelyTyposquat).toBe(false);
  });

  test("does not flag clearly unrelated short labels", () => {
    expect(detectTyposquat("nytimes.com").isLikelyTyposquat).toBe(false);
    expect(detectTyposquat("cnrs.fr").isLikelyTyposquat).toBe(false);
  });

  test("does not flag labels too short for confusion", () => {
    expect(detectTyposquat("abc.com").isLikelyTyposquat).toBe(false);
  });
});
