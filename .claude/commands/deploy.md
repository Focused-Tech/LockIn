---
description: Ship the current working tree live to the phone — build, commit, deploy to Vercel prod, verify the alias advanced
allowed-tools: Bash, Read, Grep, Glob
---

Ship LockIn's current changes all the way live on the user's phone. This project's mobile app is a Capacitor shell that loads the live Vercel site directly (`server.url = https://lockin-three-zeta.vercel.app`), so a Vercel prod deploy IS the "OTA" — there is NO Firebase Hosting and NO separate OTA tool. "Done" means live on-device, not "build passes."

Run these steps in order. If a step fails, STOP and report the exact failure — never silently skip the deploy.

1. **Build gate.** Run `npm run build`. If it exits non-zero, stop and show the error. Do not deploy a broken build.

2. **Commit.** If the working tree has changes, `git add -A` and commit with a concise message describing the change (their history is per-feature commits on `master`; commit directly to `master`, matching that pattern). End the message with the standard `Co-Authored-By` line. If the tree is already clean, note it and continue.

3. **Deploy to prod.** Run `npx vercel --prod --yes`. Wait for it to finish (it's slow — run in background and wait). Confirm `readyState: READY` and `target: production` in the output.

4. **Verify the alias advanced.** Run `npx vercel inspect lockin-three-zeta.vercel.app` and confirm the reported deployment `id` matches the `dpl_...` id from step 3, with a `created` timestamp of minutes ago. This alias is the exact URL the app loads — if it didn't advance, the phone won't see the change. (PowerShell may report exit 255 on a stderr hint even when inspect succeeded — read the output, not the exit code.)

5. **Rules/indexes (conditional).** If this change touched `firestore.rules`, `firestore.indexes.json`, or `storage.rules`, also run `npm run deploy:rules`. Otherwise skip.

6. **Report.** Tell the user: the new deployment id, that the alias advanced (with the created time), and to close + reopen the app to see it. If anything failed, lead with the failure.

$ARGUMENTS
