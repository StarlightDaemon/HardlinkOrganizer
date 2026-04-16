# Hardlink Organizer Next Steps

This note records the best immediate next steps after the first successful Unraid
beta validation run.

## Current state

- local beta works on a real Unraid host
- hosted web UI, scan flow, preview, and link execution are functioning
- true hardlink creation was proven by matching inode numbers
- the initial `/mnt/user` and separate source or destination mount approach produced
  misleading preview success and real `EXDEV` failures
- switching to a shared disk-level mount layout fixed execution

## Most important next steps

### 1. Unraid mount strategy and preflight hardening

Why this is first:

- it is the most important real-world correctness gap discovered in beta
- the app can currently preview as safe and still fail later on Unraid
- this affects operator trust more than any feature request

Needed outcomes:

- detect risky mount layouts before execution
- warn when separate bind mounts are likely to fail with `EXDEV`
- improve Unraid-specific deployment docs
- capture the shared disk-level parent mount recommendation explicitly

Recommended target:

- `0.2.2`

### 2. Capture and document the beta findings

Why this is second but closely tied to step 1:

- the real-host findings should be preserved in the repo before they are lost
- they directly affect future CA packaging guidance and support burden

Needed outcomes:

- update validation docs
- update Unraid packaging docs
- update any release notes or operator guidance
- document that shared disk-level parent mounts are the reliable execution pattern

### 3. Hardlink verification

Why this is next:

- highest-value feature from the new request list
- stays tightly on mission
- improves operator confidence and auditability

Needed outcomes:

- verify true hardlinks by inode and device
- distinguish copy vs hardlink vs missing destination
- export reports
- support verification by prior job or source or destination set

Recommended target:

- `0.3.0`

### 4. Destination management with safe path validation

Why this comes after verification:

- major usability improvement for less-technical users
- requires strong guardrails before it becomes safe enough

Needed outcomes:

- UI-managed destination registry
- allowlisted browse roots
- writable and compatibility validation
- safe defaults

Recommended target:

- `0.4.0`

### 5. Optional destination-side cleanup and naming polish

Why this comes later:

- useful, but not as foundational as correctness and safety
- should remain subordinate to the hardlink workflow
- should not turn the project into a full organizer or cataloger

Needed outcomes:

- optional destination-side cleanup only
- preview and operator override
- no source renaming
- conservative defaults

Recommended target:

- `0.5.0`

## Sequencing summary

1. `0.2.2`: Unraid preflight and mount-strategy hardening plus documentation updates
2. `0.3.0`: hardlink verification
3. `0.4.0`: destination management
4. `0.5.0`: destination-side cleanup and naming polish

## Guiding rule

Hardlink Organizer should remain a hardlink-focused operational tool. It should
not try to replace stronger external tools for media renaming, cataloging, or
metadata management.

## Provenance

- Date: 2026-04-16
- Basis: first successful Unraid beta validation plus current feature expansion plan
- Confidence: high
