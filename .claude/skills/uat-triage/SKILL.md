---
name: uat-triage
description: Phase 1 of the EMD user-study loop — turn a tester's UAT response docx (and the in-app issues export) into a structured triage (per-item tester quote, diagnosis against the tested version, confidence, decision, acceptance), owner decisions, test/browser mappings in handoff/rounds/<round>/items.yaml, a phased roadmap, and promotion/amendment of the UI requirements registry. Use when a new tester docx arrives or the owner says "triage", "analyze the feedback", "suggest measures", "next round".
---

# uat-triage — from tester docx to an approved, testable plan

Inputs: the tester's docx (usually `~/Downloads/EMD-<tested>-UAT-User-Response[-N]_<date>.docx`), the in-app issues
export if the tester attached one (`~/Downloads/emd-issues-*.json`, from Einstellungen → "Issues exportieren"), the
previous round's `handoff/rounds/<prev>/items.yaml`, the registry `handoff/requirements/*.yaml`.
Outputs: `.planning/<vX.Y>-UAT-TRIAGE.md`, `handoff/rounds/<vX.Y>/items.yaml`, `.planning/<vX.Y>-ROADMAP.md`,
promotions/amendments in `handoff/requirements/<AREA>.yaml`, one commit `docs(vX.Y): round-N triage`.
Round numbering: the round ships as the next minor (`v1.21`); item letter = next unused (rounds 2–8 used I…N → **O**).

## 1. Read the input verbatim
```bash
unzip -p "<docx>" word/document.xml | sed 's/<w:drawing>/[IMAGE]/g; s/<\/w:p>/\n/g; s/<[^>]*>//g' \
  | sed 's/&quot;/"/g; s/&apos;/'"'"'/g; s/&gt;/>/g; s/&lt;/</g; s/&amp;/\&/g' | sed '/^\s*$/d'
unzip -l "<docx>" | grep media/          # embedded screenshots: unzip -o "<docx>" 'word/media/*' -d /tmp/docx
```
(`anthropic-skills:docx` is the alternative for a structured read.) The tester's docx **is our previous developer-response
docx annotated inline**: under each of our items a "Test results: …" / "Answer: …" paragraph (verdict words like
"works", "fixed", "still broken"), plus an "Additional Points (NF)" section with new remarks; `[IMAGE]` marks where a
screenshot sat. Map each reply to the previous round's item ids first; new remarks get new ids. Keep the tester's
wording verbatim — it is quoted in the triage, in `items.yaml` and in the response ("You wrote: …"). The tester docx is
not committed; cite its file name. Each entry of an issues export becomes an item too (`O-ia1`, …; `tester_quote` =
description, `area` from `page`, screenshot from the export); its `appVersion` fixes `tested_version`.

## 2. Classify every remark — exactly one `decision`
| decision | meaning | goes to |
|---|---|---|
| `confirmed_closed` | tester says the previous item works | **not** a new-round item: `promotes_to` on the previous `items.yaml` + the triage header sentence (step 5) |
| `fix` | defect / accepted change request | `items.yaml` + roadmap |
| `by_design` | we keep current behaviour; explain why (feasibility, clinical correctness, prior owner decision) | `items.yaml` (browser procedure = the designed behaviour) + response with the reasoning |
| `design` | a UX proposal that needs a UI-SPEC/mockup + owner review before code (precedent: `.planning/v1.13-C1-UI-SPEC.md` + `v1.13-C1-mockup.html`) | roadmap design phase first |
| `needs_decision` | product/UX choice the owner must make — including every **reversal** of an earlier decision (I5, K3c, N8) and "ask the tester back" | AskUserQuestion, then `fix` / `by_design` / `design` (`decision` is rewritten; the question stays in `owner_decision`) |
| `deferred` | valid but out of this round (say when) | backlog note in the roadmap |

Ids: `<Letter><n>`; sub-letters (`O2a`, `O2b`) only for **independently shippable** sub-points — one workflow proposal
stays one item even if the tester wrote three paragraphs. Non-functional remarks ("too slow") are `fix` items whose
acceptance is a measurement ("profiled; Streupunkte toggle < 1 s on the 245-case cohort, number recorded in the triage"),
never an invented target. Area codes: `handoff/HANDOFF.md` §4; route vocabulary: `src/App.tsx` and the registry's
`browser.route` values; control labels: `src/i18n/translations.ts` (German default).

## 3. Diagnose against the version the tester used
- `git worktree add /tmp/emd-<tested> v<tested>` (or check out the tag) and read/reproduce **there**; if `main` has
  moved since, say per item whether the behaviour already changed. Record `grounded_on: v<tested> @ <commit>` in
  `items.yaml` and `Grounded on:` in the triage header.
- Name the mechanism with `file.ts:line`, not the symptom; measured numbers when you reproduced. Confidence: high
  (repro + cause located) / medium (cause plausible) / low (needs repro — say what you need, e.g. a screenshot).
- Production-only behaviours (CSP, fonts, cookies, serveFrontend) reproduce **only** on the container
  (`/uat-verify` §1 against the tested tag's image: `IMAGE=ghcr.io/okohlbacher/eyematics-emd-app:<tested>`).

## 4. Write the three artifacts
**`.planning/<vX.Y>-UAT-TRIAGE.md`** — header: `# vX.Y — Triage of NF UAT round R (<tester docx name>)`, then
`Grounded on: v<tested> @ <commit>`, then one paragraph "Re-test of v<tested>. **Confirmed-fixed:** …" quoting the
tester's verdict words. Sections per UI area (`## 🔵 <area>`; `## 🔴 Reversal — owner decision needed`; `## 💡
Enhancement (NEW)`). Per item, exactly this block (SEVERITY ∈ HIGH / MEDIUM / LOW):
```
### O3 — <short title> (<parent-id> follow-up, MEDIUM)
Tester: "<verbatim>"
**Diagnosis:** … (`file.ts:line`, measured numbers)
**Proposed measure(s):** … — or — **Fix options (DECISION):** A — … B — … (effort: Low / Medium / Largest item this round)
**Acceptance:** <the acceptance lines, verbatim from items.yaml>
**Confidence:** high|medium|low (reason)
**Decision:** fix | by_design | design | needs_decision | deferred   **Owner:** <answer, date>  (after step 6)
```
Close with `## Registry changes this triage` (promoted / amended / retired ids with their statements) and
`## Decisions needed from owner` (numbered, recommended option first).

**`handoff/rounds/<vX.Y>/items.yaml`** — start from `handoff/rounds/TEMPLATE/items.yaml` (it ships with `items: []`;
copy the commented example per item). `fix` items need `acceptance` (observable in the running app — what the tester
will check, not what we will code), `tests` (planned: file `tests/<Surface>Round<R>.test.tsx` may not exist yet — the
harness reports PLANNED; title substring = the item id in brackets, `[O3]`, which `/uat-implement` puts into the it()
title) and `browser` (route with query params, steps with German labels, unambiguous `expect`). `by_design` items need
the `browser` block describing the designed behaviour. Validate:
`npm run requirements -- --round handoff/rounds/<vX.Y> --no-run` → 0 schema errors (PLANNED warnings are expected).

**`.planning/<vX.Y>-ROADMAP.md`** — header (source, owner decisions + date, process line), `## Phase N — <name>` with
item ids (a `design` item gets its own phase before implementation), `## Sequencing` (what blocks what, shared files
such as `src/i18n/translations.ts`, items sharing a component). Workstreams (WS-A/B/C) group items by file ownership so
parallel agents never edit the same file. Reference shape: `.planning/v1.15-ROADMAP.md`.

## 5. Registry: promote, amend, retire
**Promote** — for every item of the previous round the tester now confirms and whose `promotes_to` is still empty:
next free id (`grep -o 'UIR-<AREA>-[0-9]*' handoff/requirements/<AREA>.yaml | sort | tail -1` + 1), statement = the
behaviour (not the fix), `status: implemented`, `sources: ["UAT <prev> <id>", "confirmed <vX.Y>"]`, `tests` and
`browser` copied from the previous `items.yaml` (if there is no previous `items.yaml`, from the registry entries that
already cite the item), then write the new id into that item's `promotes_to`. `by_design` outcomes are promoted with
"(by design)" in the statement.
**Amend** — for every accepted reversal: find the affected ids (`grep -n '<old item id>' handoff/requirements/*.yaml`),
keep the id, rewrite `statement`/`browser.expect` to the new behaviour, move the old statement into `notes`, append
`sources: "UAT vX.Y <id> — reverses <old item>, owner decision <date>"`, remap `tests` to the title the implementer
will write (the old test is rewritten in `/uat-implement`, not deleted).
**Retire** — behaviour removed entirely: `status: retired` (the harness ignores it), reason in `notes`, id never reused.
Re-run `npm run requirements -- --no-run`. List every change under `## Registry changes this triage`.

## 6. Owner decisions, then approval
Batch the `needs_decision`/`design` items into AskUserQuestion calls (≤ 4 questions each, recommended option first,
one line of consequence per option). Without AskUserQuestion (SDK/subagent runtime): end the turn after writing
`## Decisions needed from owner` and wait. Record answers in the triage (`**Owner:**`) and in `items.yaml`
(`owner_decision`, and rewrite `decision`). Then ask for approval of **roadmap + acceptance criteria + registry changes**
together; record `Approved <date>: roadmap, acceptance, registry` in the triage header. Implementation starts only
then. Commit: `docs(vX.Y): round-N triage` + the Co-Authored-By trailer from the session's system reminder.
