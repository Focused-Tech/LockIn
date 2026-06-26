import { describe, it, expect } from "vitest";
import { deepLinkToInAppPath } from "./deepLink";

describe("deepLinkToInAppPath", () => {
  it("maps lockin://slate/<id> to the in-app slate screen", () => {
    expect(deepLinkToInAppPath("lockin://slate/seed-beg-nba")).toBe(
      "/app/slate/seed-beg-nba",
    );
  });

  it("handles a trailing slash on the slate link", () => {
    expect(deepLinkToInAppPath("lockin://slate/seed-beg-nba/")).toBe(
      "/app/slate/seed-beg-nba",
    );
  });

  it("maps a bare lockin://beginner to the beginner journey", () => {
    expect(deepLinkToInAppPath("lockin://beginner")).toBe("/app/beginner");
  });

  it("falls back to /app for the scheme root", () => {
    expect(deepLinkToInAppPath("lockin://")).toBe("/app");
  });

  it("maps the https /s/<id> share landing to the slate screen", () => {
    expect(
      deepLinkToInAppPath("https://lockin-three-zeta.vercel.app/s/seed-beg-nba"),
    ).toBe("/app/slate/seed-beg-nba");
  });

  it("passes other https paths through", () => {
    expect(
      deepLinkToInAppPath("https://lockin-three-zeta.vercel.app/app/wallet"),
    ).toBe("/app/wallet");
  });

  it("returns null for a malformed url", () => {
    expect(deepLinkToInAppPath("not a url")).toBeNull();
  });
});
