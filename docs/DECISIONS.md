# Decisions and deviations from the SRS

Every decision that changes or fills a gap in the IFS 317 Part 1 SRS is logged here so the group can update the SRS. Times are SAST.

| ID | Date | Decision | Why | REQ / NFR |
|---|---|---|---|---|
| D-001 | 2026-10-14 | Product catalogue confirmed by the owner: four cake pop flavours. Belgian Chocolate R15, Top Deck R15, Cookies and Cream R12, Funfetti R10. Cupcakes and cinnamon rolls are not in the MVI catalogue. | Spec section 5 asks for the real catalogue before seeding. | REQ-04, products table |
| D-002 | 2026-10-14 | Use Supabase's newer key names: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The publishable key has the same `anon` role, so RLS behaves the same. | The project and Vercel integration already issue publishable keys; renaming would break the existing deployment. | Security NFR |
| D-003 | 2026-10-14 | Public sign-up removed. Owner and helper accounts are created by a team member in the Supabase dashboard and given a role in `staff_roles`. | Anyone could otherwise create an account; staff access must be controlled. | Security NFR, gap 6 |
| D-004 | 2026-10-14 | Front-end follows the Figma Make design "KD Pops ordering website" (cream/chocolate palette, retro display headings, Poppins body, pill buttons). Extra steps the SRS requires (POPIA consent, under-18 gate, language toggle, status link) are added in the same style. | The Figma design predates the SRS flow and has no consent step. | REQ-01, REQ-21, Usability NFR |
| D-005 | 2026-10-14 | Collection is a week plus a time slot: 2nd break (11:45-12:00) or after school (14:30-15:00). | Figma design specifies slots; SRS only says "collection week". | REQ-04 |
| D-006 | 2026-10-14 | Build order: dashboard and notifications before the AI chat (M5, M6 before M4). | A working order -> approve -> pay loop is the owner's main need; chat plugs into it. | Milestones |

## Open gaps from spec section 8 (to resolve in M1)

1. `waitlisted` order status
2. `orders.released_at`
3. `orders.revised_collection_date`
4. `orders.access_token_hash`
5. `notifications`, `job_runs`, `error_log` tables
6. `staff_roles`
7. Configurable last school day
8. Anon role access model (API-only vs direct insert)
