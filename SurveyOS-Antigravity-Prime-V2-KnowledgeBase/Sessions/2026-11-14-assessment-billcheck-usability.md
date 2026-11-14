# 2026-11-14 — Assessment / Bill Check usability (Claude Code)

Owner asked for a UX audit of the Assessment and Bill Check tabs, then improvements to the current structure.

- Audit written: `docs/research/2026-11-14-assessment-billcheck-ux-audit.md` (30+ findings, scored).
- Mock-ups tried and rejected by the owner: checklist grid, one-item-at-a-time card, car damage map + stamps + money waterfall. Owner wants the current structure improved, not redesigned.
- Owner decisions: keep Paint / Part / Labour Row buttons; policy check compulsory like the print pop-up, first; Allow as ✓ / ✕ icon on the right next to Price+GST; all rows allowed by default (already so in `createAssessmentRow`).
- My calls: "Answer later" link kept on the policy pop-up (printing still blocked); Bill Check delete warns rather than being removed.
- Built batch 1 (see Changelog). Checked in sandbox mode: `npm run dev`, then `localhost:3000/?sandbox=true` skips login. Useful for any UI check.
- Found: `--font-sans: var(--font-sans)` in `globals.css` means Inter never applies; whole app is in Times New Roman. Not fixed, owner to decide.
- Next: batch 2 (bulk actions, Pending filter, one reconciliation figure).
