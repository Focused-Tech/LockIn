// Vitest stub for `server-only` / `client-only`. These packages throw at import to enforce the RSC
// boundary at BUILD time (Next strips server code from client bundles / vice-versa). Vitest has no
// such bundler, so importing a real client component that references a server action would throw here.
// The admin SDK is lazily initialized, so importing a server module in a test is inert — nothing runs
// until a function is actually called. This stub lets those imports resolve to a no-op.
export {};
