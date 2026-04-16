# Community Apps Publishing Guide

This guide prepares Hardlink Organizer for Community Apps publication using the workflow described in the Unraid Docker FAQ and related publishing guidance.

## What Unraid expects

The Unraid Docker FAQ states that for Community Apps publication you should:

- create and upload your XML template files to GitHub
- preferably use a separate repository for the XML files
- keep the XML files on the `main` or `master` branch
- submit the repository through the Community Apps submission form
- create a support thread
- set categories in the template

It also notes that CA will overwrite or correct `TemplateURL` in normal circumstances.

## What is already prepared here

- draft CA template: `packaging/unraid/templates/hardlink-organizer.xml`
- maintainer profile draft: `packaging/unraid/templates/ca_profile.xml`
- icon asset: `packaging/unraid/assets/hardlink-organizer.svg`
- support thread draft: `packaging/unraid/SUPPORT_THREAD_DRAFT.md`

## Recommended next steps

### 1. Create a dedicated template repository

Recommended repository example:

- `StarlightDaemon/unraid-templates`

Reason:

- Unraid recommends keeping XML templates separate from the main application repository where practical.

Suggested contents of that repository:

- `hardlink-organizer.xml`
- `ca_profile.xml`
- any icons or supporting assets referenced by the XML

### 2. Copy the prepared draft files

Copy these into the new template repository:

- `packaging/unraid/templates/hardlink-organizer.xml`
- `packaging/unraid/templates/ca_profile.xml`
- `packaging/unraid/assets/hardlink-organizer.svg`

### 3. Create the real support thread

Use:

- `packaging/unraid/SUPPORT_THREAD_DRAFT.md`

After posting the thread on the Unraid forums:

- replace the placeholder GitHub Issues support link in the XML with the final forum thread URL

### 4. Review the XML before submission

Pay particular attention to:

- `Repository`
- `Project`
- `Support`
- `Icon`
- `Category`
- `WebUI`

Important:

- the web UI entry should reference the container port, not the host port
- avoid pre-filling user share host paths for media mounts unless you really want those shares auto-created

### 5. Submit to Community Apps

The Unraid FAQ references the Community Apps submission form:

- `https://form.asana.com/?k=nT_3f3a-IWLSppNkAOzz7Q&d=40737536503922`

After submission:

- CA validation may adjust minor template details
- new repositories are typically reviewed manually
- later XML changes in the repository are picked up automatically by CA

## Publish readiness checklist

- dedicated template repository created
- XML committed to `main` or `master`
- 2FA enabled on GitHub
- support thread created
- XML support URL updated to that thread
- categories present
- icon URL reachable
- GHCR image published and pullable
- real Unraid validation completed

## Current status

This repository is now prepared for the CA publication workflow, but actual publication still requires:

- pushing the files to GitHub
- creating the support thread
- optionally moving the XML assets into a dedicated template repository
- submitting the CA form
