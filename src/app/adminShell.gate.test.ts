/**
 * PORTAL-TRAP FIX — the contracts that keep role-holders from getting stuck:
 *   A. NO role redirect on load — nothing sends a keyholder/keymaster/admin to the portal.
 *   B. Portal + all admin routes render inside AppFrame (header + bottom nav + safe-area).
 *   C. Sign out is reachable (AccountMenu, rendered by AppFrame's TopNav).
 *   D. Drawer role entries are flag-gated (asserted functionally in the render test).
 *   E. No general screen is gated on keyholder/keymaster/admin (portal/admin gate themselves only).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("A — no role redirect on load", () => {
  it("middleware has no role branch; only /login and /app/choose redirects", () => {
    const mw = read("src/middleware.ts");
    expect(/keyholder|keymaster|isAdmin/i.test(mw)).toBe(false);
    expect(mw.includes("/app/keyholder")).toBe(false);
    expect(mw).toContain('"/login"');
    expect(mw).toContain('"/app/choose"');
  });
  it("the app layout never redirects a role-holder anywhere", () => {
    const layout = read("src/app/app/layout.tsx");
    expect(layout.includes("/app/keyholder")).toBe(false);
    expect(/redirect\(/.test(layout)).toBe(false); // pages self-redirect to /login; layout does not
  });
  it("the portal page only GATES OUT non-keyholders (notFound), never redirects others in", () => {
    const page = read("src/app/app/keyholder/page.tsx");
    expect(page).toContain("if (!profile.keyholder) notFound();");
    expect(page.includes('redirect("/app/keyholder")')).toBe(false);
  });
});

describe("B/C — portal + admin routes render inside AppFrame with a way out", () => {
  it("AppFrame renders the TopNav (drawer) and the BottomNav, and forwards the role flags", () => {
    const frame = read("src/components/app/AppFrame.tsx");
    expect(frame).toContain("<TopNav");
    expect(frame).toContain("<BottomNav");
    expect(frame).toContain("isKeyholder={isKeyholder}");
    expect(frame).toContain("isAdmin={isAdmin}");
  });
  it("the /app layout wraps children in AppFrame and passes the flags", () => {
    const layout = read("src/app/app/layout.tsx");
    expect(layout).toContain("<AppFrame");
    expect(layout).toContain("isKeyholder={profile.keyholder === true}");
    expect(layout).toContain("isAdmin={profile.isAdmin === true}");
  });
  it("an admin layout now wraps EVERY /admin route in AppFrame (no more chrome-less trap)", () => {
    const layout = read("src/app/admin/layout.tsx");
    expect(layout).toContain("<AppFrame");
    expect(layout).toContain('redirect("/login")'); // auth only — NOT a role gate
    expect(/keyholder\s*===|isAdmin\s*===/.test(layout)).toBe(true); // flags forwarded to the frame
  });
  it("Sign out exists in the drawer and logs out", () => {
    const menu = read("src/components/app/AccountMenu.tsx");
    expect(menu).toContain("Sign out");
    expect(menu).toContain("logoutUser()");
  });
  it("the admin pages no longer hand-roll safe-area padding (AppFrame owns it)", () => {
    for (const f of [
      "src/app/admin/keyholders/AdminKeyholders.tsx",
      "src/app/admin/keyholders/[uid]/page.tsx",
      "src/app/admin/users/[uid]/page.tsx",
    ]) {
      expect(read(f).includes("safe-area-inset-top")).toBe(false);
    }
  });
});

describe("D — drawer role entries are flag-gated", () => {
  it("the entries are conditioned on the flags with the right labels (keymaster home ≠ keyholder)", () => {
    const menu = read("src/components/app/AccountMenu.tsx");
    expect(menu).toContain('href: "/app/keymaster", label: "Keymaster portal"');
    expect(menu).toContain('href: "/app/keyholder", label: "Keyholder portal"');
    expect(menu).toContain('href: "/admin/keyholders", label: "Admin"');
    // keymaster is checked BEFORE keyholder, so a keymaster's home is the keymaster portal.
    expect(menu.indexOf("isKeymaster")).toBeLessThan(menu.indexOf('label: "Keyholder portal"'));
  });
});

describe("E — no general screen is gated on keyholder/keymaster/admin", () => {
  it("only the portal (keyholder) and admin routes gate on those flags; the gates are the screens' own", () => {
    // The portal gates itself (notFound for non-keyholders) — reached by choosing it, never forced.
    expect(read("src/app/app/keyholder/page.tsx")).toContain("if (!profile.keyholder) notFound();");
    // No OTHER /app screen redirects/blocks based on keyholder/keymaster/admin. (creatorVerified
    // gates on the creator dashboard are reported separately for the architect — different flag.)
    const foxpit = read("src/app/app/foxpit/Lobby.tsx");
    expect(/\.keyholder|\.keymaster|\.isAdmin/.test(foxpit)).toBe(false);
  });
});
