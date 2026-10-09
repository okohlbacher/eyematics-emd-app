// Workflow: uat-verify — adversarial browser verification of a UAT round against the running container.
// Invoke: Workflow({scriptPath: '.claude/workflows/uat-verify.js', args: {round: 'v1.21', date: '2026-10-20', baseUrl: 'http://127.0.0.1:3311', repo: '<abs path>'}})
// args.round and args.date are REQUIRED (Date.now()/new Date() are unavailable in workflow scripts); args.repo (absolute path of the checkout) is REQUIRED.
// Design is parallel (one skeptic per item), execution is sequential (the browser pane is a single shared surface).
export const meta = {
  name: 'uat-verify',
  description: 'Design refutation attempts per round item in parallel, execute them one by one in the browser against the container, write verification.yaml, critique completeness',
  phases: [{ title: 'Load' }, { title: 'Design', detail: 'one skeptic per item' }, { title: 'Execute', detail: 'sequential — one browser pane' }, { title: 'Record' }, { title: 'Critique' }],
}
if (!args || !/^v\d+\.\d+(\.\d+)?$/.test(String(args.round)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(args.date))) {
  throw new Error('uat-verify: args must be {round: "vX.Y", date: "YYYY-MM-DD", baseUrl?, repo?}')
}
if (!args.repo) throw new Error('uat-verify: args.repo (absolute path of the app checkout) is required')
const REPO = args.repo
const round = args.round
const baseUrl = args.baseUrl || 'http://127.0.0.1:3311'
const ITEMS = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['id', 'title', 'acceptance', 'route', 'steps', 'expect'], properties: {
  id: { type: 'string' }, title: { type: 'string' }, tester_quote: { type: 'string' }, acceptance: { type: 'array', items: { type: 'string' } },
  route: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, expect: { type: 'string' } } } } } }
const PLAN = { type: 'object', required: ['refutations'], properties: { refutations: { type: 'array', items: { type: 'object', required: ['attempt', 'how', 'would_prove_failure'], properties: {
  attempt: { type: 'string' }, how: { type: 'string' }, would_prove_failure: { type: 'string' } } } } } }
const VERDICT = { type: 'object', required: ['result', 'evidence'], properties: { result: { type: 'string', enum: ['PASS', 'FAIL', 'BLOCKED'] }, evidence: { type: 'string' }, notes: { type: 'string' } } }
const DONE = { type: 'object', required: ['file', 'count'], properties: { file: { type: 'string' }, count: { type: 'number' } } }
const CRIT = { type: 'object', required: ['gaps'], properties: { gaps: { type: 'array', items: { type: 'string' } } } }

phase('Load')
const loaded = await agent(`Read ${REPO}/handoff/rounds/${round}/items.yaml and return every item whose decision is fix or by_design AND that has a browser block, as {id, title, tester_quote, acceptance (empty array if none), route (browser.route), steps (browser.steps), expect (browser.expect)}. Do nothing else.`, { label: 'load', phase: 'Load', schema: ITEMS, effort: 'low' })
const items = loaded ? loaded.items : []
log(`${items.length} verifiable items (fix/by_design with a browser block) in ${round}`)

phase('Design')
const plans = await parallel(items.map(it => () => agent(`You are a skeptical UAT tester. Item ${it.id} — ${it.title}. Tester asked: "${it.tester_quote || ''}". Acceptance: ${JSON.stringify(it.acceptance)}. Nominal procedure: route ${it.route}, steps ${JSON.stringify(it.steps)}, expect "${it.expect}". For a by_design item the goal is to prove the DESIGNED behaviour is NOT what is observable. Design 3–5 additional attempts to PROVE THE FIX DID NOT LAND or does not match the tester's intent (other data: centres, patients, cohorts, metric tabs; toggles off/on/off; reload; dark mode; English UI; narrow viewport; edge values). Read the relevant code under ${REPO}/src to pick attempts that target the actual mechanism. Each attempt: how to do it in the browser (German control labels) and what observation would prove failure.`, { label: 'design:' + it.id, phase: 'Design', schema: PLAN, effort: 'high' })))

phase('Execute')
const verdicts = []
for (let i = 0; i < items.length; i++) {
  const it = items[i], plan = plans[i]
  const v = await agent(`Verify item ${it.id} — ${it.title} on the running EMD container at ${baseUrl} using the Claude browser pane tools (load them with ToolSearch "select:mcp__Claude_Browser__preview_start,mcp__Claude_Browser__navigate,mcp__Claude_Browser__find,mcp__Claude_Browser__form_input,mcp__Claude_Browser__computer,mcp__Claude_Browser__read_page,mcp__Claude_Browser__javascript_tool,mcp__Claude_Browser__browser_batch,mcp__Claude_Browser__resize_window,mcp__Claude_Browser__read_console_messages"). Login: preview_start ${baseUrl}/login → resize_window 1440x900 → find "Benutzername" → form_input the seeded admin user from ${REPO}/server/index.ts → find "Passwort" → form_input the default password from ${REPO}/docs/Konfiguration.md (Standardbenutzer) → find "Weiter" → left_click. Then: nominal procedure — route ${it.route}, steps ${JSON.stringify(it.steps)}, expect "${it.expect}" — and every refutation attempt: ${JSON.stringify(plan ? plan.refutations : [])}. Read facts from the DOM/JS, take a screenshot as proof. PASS only if the nominal expectation holds AND no attempt proves failure. Return result, evidence (concrete DOM/JS facts, screenshot paths), notes (what deviated, if anything). If the browser tools are unavailable, return BLOCKED with the reason.`, { label: 'verify:' + it.id, phase: 'Execute', schema: VERDICT, effort: 'high' })
  verdicts.push({ id: it.id, ...(v || { result: 'BLOCKED', evidence: 'agent returned nothing' }) })
  log(`${it.id}: ${verdicts[verdicts.length - 1].result}`)
}

phase('Record')
const rec = await agent(`Write ${REPO}/handoff/rounds/${round}/verification.yaml (template: ${REPO}/handoff/rounds/TEMPLATE/verification.yaml) with round=${round}, verified_at=${args.date}, deployment="emd-smoke built from $(git rev-parse --short HEAD) at ${baseUrl}" and these results: ${JSON.stringify(verdicts)}. MERGE, do not rewrite: keep every existing record whose id is not in this list (UIR-… registry records and hand-written item records alike); replace only the ids listed here. Validate with: cd ${REPO}; . scripts/useavibe/node22.sh; node scripts/requirements-check.mjs --round handoff/rounds/${round} --no-run`, { label: 'record', phase: 'Record', schema: DONE, effort: 'low' })

phase('Critique')
const crit = await agent(`Completeness critic for round ${round}. Items: ${JSON.stringify(items.map(i => i.id))}. Verdicts: ${JSON.stringify(verdicts)}. Read ${REPO}/handoff/rounds/${round}/items.yaml and ${REPO}/.planning/${round}-UAT-TRIAGE.md. List gaps: items without a verdict, PASS verdicts whose evidence does not actually cover every acceptance line, attempts that were skipped, registry areas touched by this round that still need a regression browser pass (run: node scripts/requirements-check.mjs --browser --area <AREA> for each touched area and list the ids).`, { label: 'critic', phase: 'Critique', schema: CRIT, effort: 'high' })
return { verdicts, recorded: rec, gaps: crit ? crit.gaps : [] }
