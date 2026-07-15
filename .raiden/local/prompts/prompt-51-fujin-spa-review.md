# Prompt 51: Fujin SPA Implementation Review

**Governance Authority:** Fujin UI Kit (`E:\Citadel/Fujin/llms-full.txt`)
**Reviewer Role:** Fujin Design System Agent — Compliance audit
**Strategy:** Review only — no changes unless a violation requires immediate correction
**Recommended model:** Claude Sonnet 4.6
**Recommended mode:** planning off — audit and report

---

## 0. What this review is for

The previous session (prompt-51 builder pass) replaced the entire Hardlink Organizer frontend
with a React SPA. All Carbon CSS, `--cds-*` vars, IBM Plex font, and Jinja2 server injection
were removed. The SPA is built with Vite + React 18 + Mantine v7 + the **Fujin UI kit**.

You are the Fujin agent. Your job is to audit the implementation against the Fujin contract
(token usage, CSS var usage, component APIs, composition patterns, design rules) and produce a
written report with findings. Fix any clear violations you find; flag anything that requires a
product decision for the user.

---

## 1. Repository and design system

- **Project root:** `E:\Citadel/HardlinkOrganizer`
- **Frontend source:** `webapp/frontend/src/`
- **Fujin reference (read this first):** `E:\Citadel/Fujin/llms-full.txt`
- **Fujin components:** `E:\Citadel/Fujin/components/`
- **Tokens file:** `E:\Citadel/Fujin/tokens.json`

Do not open any other Fujin file beyond `llms-full.txt`.

---

## 2. Files to audit

Audit every `.tsx` file under `webapp/frontend/src/`. The full tree is:

```
src/
├── App.tsx
├── main.tsx
├── api/
│   ├── client.ts           (no UI — skip design audit)
│   └── types.ts            (no UI — skip design audit)
├── state/
│   └── AppState.tsx        (no UI — skip design audit)
└── components/
    ├── AppLayout.tsx
    ├── DestRegistry.tsx
    ├── HistorySidebar.tsx
    ├── VerifyPanel.tsx
    └── steps/
        ├── BrowseStep.tsx
        ├── DestStep.tsx
        ├── PreviewStep.tsx
        ├── ResultStep.tsx
        └── SourceStep.tsx
```

---

## 3. Audit checklist

For every UI file, verify:

### 3.1 Token-First Rule (MUST — no exceptions)
- [ ] Every color value uses a CSS var (`var(--fujin-*)`) or `tokens.*` property — **no hardcoded hex, rgba, or named colors**
- [ ] Every spacing value uses `tokens.spacing.scale.*` — no raw px numbers except where a `px` suffix is appended to a token value (e.g., `${tokens.spacing.scale.md}px` is acceptable; `16px` hardcoded is not)
- [ ] Every font-family references `tokens.typography.fontFamily.base` or `.mono` — no hardcoded font strings
- [ ] Every font-size uses `tokens.typography.fontSize.*`
- [ ] Every font-weight uses `tokens.typography.fontWeight.*`
- [ ] Every letter-spacing uses `tokens.typography.letterSpacing.*`
- [ ] Every opacity uses `tokens.opacity.*`

### 3.2 Sharp-Edge Mandate (MUST — no exceptions)
- [ ] No `borderRadius` value other than `tokens.radius.default` (= `0`) anywhere in inline styles
- [ ] Mantine component `radius` props are set to `tokens.radius.default` where the component accepts one

### 3.3 Component API compliance
- [ ] `DataTable` — `columns` have valid `DataColumn<T>` shape; `rowKey` is set; `rowActions` uses `ActionMenu` or `UnstyledButton` only
- [ ] `WorkflowStepper` — `steps` array has correct `WorkflowStep` shape; `validate` returns `true | string` (not a Promise)
- [ ] `DataCard` — `title` present; `badge` slot uses `StatusBadge`; `actions` array ≤ 4 items
- [ ] `StatusBadge` — `status` is one of `success | danger | warning | info | neutral`; `label` is a string
- [ ] `ActionMenu` — `items` have `label`, `onClick`; danger items use `danger: true`
- [ ] `SectionHeader` — `title` present; `action` slot is a ReactNode (not a string)
- [ ] `FormShell` — `onSubmit` is `(e: FormEvent) => void`; not async in the prop itself
- [ ] `FujinThemeProvider` — present in provider chain; `defaultMode="dark"` set
- [ ] `FujinToastProvider` — present inside `FujinThemeProvider`; `useToast()` only called inside it

### 3.4 Spacing ownership rule
- [ ] No component sets its own `margin` or `marginBottom` externally — spacing is the caller's responsibility
- [ ] Sections separated by `gap` on a flex container, not by `marginBottom` on section components
- [ ] Within a section, `marginTop` on content (not `marginBottom` on `SectionHeader`) separates header from content

### 3.5 Progressive Disclosure Rule
- [ ] Cards with >2 primary actions use `ActionMenu` overflow — no more than 2 exposed directly
- [ ] Collapsible detail uses `DataCard` `detail` prop + `Collapse`/`useDisclosure`, not ad-hoc show/hide

### 3.6 Density Rule
- [ ] No double-border pattern (a bordered container inside another bordered container sharing the same edge)
- [ ] No stacked borders

### 3.7 No CSS / Carbon remnants
- [ ] Zero occurrences of `--cds-*` CSS vars
- [ ] Zero occurrences of `IBM Plex` or `@carbon`
- [ ] Zero occurrences of `carbon-overrides.css` or `style.css` imports
- [ ] Zero occurrences of `window.__SETS__`, `window.__SUMMARIES__`, `window.__VERSION__`

---

## 4. Known implementation notes (from builder session)

The builder noted one TypeScript quirk in `SourceStep.tsx` — a `fontFamily` key appears twice in
a single style object. This is a TypeScript/linting issue (duplicate key) — the second assignment
silently wins. Fix this.

`validate()` functions in workflow steps are synchronous wrappers that read React state captured
via closure. This is correct for Fujin's `validate: () => true | string` contract.

The builder used `<a download href={...}>` for CSV/JSON export links in `VerifyPanel` instead of
`UnstyledButton` — verify this is acceptable per the brief (it is: "UnstyledButton styled with
`var(--fujin-border-subtle)`" is what the brief asks for; `<a>` tags with equivalent styling are
functionally correct for file downloads, but check they carry proper Fujin token styles).

---

## 5. Report format

Produce a report with three sections:

### PASS
List each checklist item that passed, with the file(s) verified.

### FAIL / FIXED
For each violation: file path + line reference, what the violation was, and what you changed.

### FLAG (requires product decision)
For any item where you cannot determine correctness without a product decision (e.g., a
UX pattern that diverges from the brief but may be intentional), describe the finding and
ask the user what they want.

---

## 6. Acceptance condition

The review is complete when:
1. All MUST violations (Token-First, Sharp-Edge, Carbon remnants) are either fixed or confirmed absent
2. All component API shapes are valid
3. The duplicate `fontFamily` key in `SourceStep.tsx` is fixed
4. The report is written and any FLAG items are surfaced to the user
