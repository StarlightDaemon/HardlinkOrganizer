# Hardlink Organizer — Validation Checklist (v0.2.1)

This checklist provides a structured procedure for an operator to validate Hardlink Organizer (v0.2.1) on a real Unraid host.

## Introduction
The goal of this validation pass is to ensure the core hardlink engine, web UI, and Docker packaging work harmoniously on an actual Unraid system where path resolution (shfs) and device IDs behave differently than on a standard Linux desktop or WSL environment.

---

## 1. Environment & Setup Preparation
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 1.1 | Verify Unraid OS version is 6.12+ (standard Docker environment). | Host is running a modern Unraid version. | Incompatible Docker or path handling behavior. |
| 1.2 | Prepare a test share (e.g., `/mnt/user/temp_hlh_test`) or ensure existing source/destination paths are on the same Unraid pool/disk. | Target paths are ready for testing. | Cannot test same-device validation if paths are not on the same array/pool. |
| 1.3 | Create the appdata directory: `mkdir -p /mnt/user/appdata/hardlink-organizer/data`. | Directory is created successfully. | Permission issues or disk space problems. |
| 1.4 | Copy `config.example.toml` to `/mnt/user/appdata/hardlink-organizer/config.toml`. | File exists at the new location. | Setup cannot proceed without a config file. |

## 2. Configuration & Path Mapping
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 2.1 | Edit `/mnt/user/appdata/hardlink-organizer/config.toml` to map `db_file`, `log_file`, `index_json`, and `index_tsv` to `/data/...`. | Paths inside the TOML use the container-side `/data/` prefix. | Relative or host-only paths will fail inside the container. |
| 2.2 | Define at least one `source_set` and one `dest_set` in the TOML. | `movies = "/mnt/src/movies"`, etc., are defined. | The tool will have nothing to scan or link. |
| 2.3 | Prefer a shared disk-level or pool-level parent bind mount such as `/mnt/disk3:/mnt/disk3`, then point both `source_set` and `dest_set` paths inside that one mount. | Source and destination stay under one shared container mount. | Separate mounts may still fail with `EXDEV` even when preview looks same-device. |
| 2.4 | If you intentionally test `/mnt/user` or separate `/mnt/src/...` and `/mnt/dst/...` mounts, treat that as a risky-layout check rather than a recommended deployment. | Preview may show a warning even when device IDs match. | Missing warning coverage or unclear operator guidance. |

## 3. Container Initialization & Health Check
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 3.1 | Start the container: `docker compose -f packaging/unraid/docker/docker-compose.yml up -d`. | Container status is "Up" or "Running". | Image build failure or runtime crash (check `docker logs`). |
| 3.2 | Check container logs: `docker logs hardlink-organizer`. | Logs show `Uvicorn running on http://0.0.0.0:7700`. | Web server failed to bind to the port. |
| 3.3 | Access the Web UI at `http://<unraid-ip>:7700`. | Browser displays the Hardlink Organizer dashboard. | Network/Firewall issue or container networking failure. |

## 4. Scan & Inventory Workflow
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 4.1 | Click "Scan All Source Sets" in the UI. | Progress indicators appear; scan completes without errors. | Permissions issue on source paths or engine crash. |
| 4.2 | Verify SQLite DB update: `ls -l /mnt/user/appdata/hardlink-organizer/data/state.db`. | File size is > 0 and timestamp is current. | Persistence layer failure; scans won't survive restarts. |
| 4.3 | Browse a Source Set inventory in the UI. | A list of files/directories appears with "Display Names" (cleaned) and "Real Names". | Scanner failed to populate the database or inventory view. |

## 5. Preview & Validation Logic
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 5.1 | Select a source entry and a destination set. Click "Preview". | UI shows a "Link Plan" with source and destination full paths. | Logic error in mapping source -> destination. |
| 5.2 | **Negative Test**: Attempt to link between different devices (e.g., different Unraid pools). | UI displays a "Device ID mismatch" or "Cross-device link refused" error. | **CRITICAL SAFETY FAILURE.** The engine must block cross-device hardlinks. |
| 5.3 | Verify the "Suggested Destination Name" matches the cleaned display name. | Destination subpath text box is pre-filled with a clean name. | Display-name cleanup logic is broken. |
| 5.4 | If preview uses `/mnt/user` or separate source/destination mounts, verify the UI shows a mount-layout warning before execution. | Warning explains that preview can still fail with `EXDEV` and recommends a shared parent mount. | Risky Unraid layouts are still too easy to misread as safe. |

## 6. Execution & Fidelity Verification
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 6.1 | Click "Execute Link" on a valid same-device preview. | Success message appears; summary shows files linked. | Engine execution failure (permissions, path resolution). |
| 6.2 | Check the real host filesystem: `ls -i <source_file> <dest_file>`. | **Both files must have the SAME Inode number.** | **FAILURE.** If inodes differ, it's a copy, not a hardlink. |
| 6.3 | **Collision Test**: Execute the same link operation again. | UI shows "0 linked, 1 skipped". Result is "Success" (skip is successful). | Collision policy is not being enforced (skipped files). |
| 6.4 | Check logs: `cat /mnt/user/appdata/hardlink-organizer/data/hardlink-organizer.log`. | Log contains a timestamped record of the link/skip operation. | Logging system failure. |

## 7. Cleanup & Rollback
| # | Action | Expected Result | Failure Meaning |
|---|---|---|---|
| 7.1 | Delete a test-created hardlink in the destination. | Destination file is gone; source file remains intact. | Standard filesystem behavior; safety check. |
| 7.2 | Stop container and delete `state.db`. | Tool starts fresh with an empty inventory on next run. | State is effectively cleared. |

---

## Known Unraid Specific Risks
- **SHFS Latency**: Large scans on `/mnt/user` can be slow; verify timeout behavior.
- **Cache vs Array**: Hardlinks *cannot* span from Cache pool to Array, even if they are in the same User Share. Always map to the same pool/disk for hardlink compatibility.
- **Separate Bind Mounts**: Even when `st_dev` matches, separate source and destination mounts can still fail with `EXDEV` on Unraid. Shared disk-level parent mounts are the reliable pattern.
- **Docker Path Shifts**: Ensure `config.toml` "source/dest" relative paths stay consistent after container updates.

## Verification Notes
- **Operator Name**: ____________________
- **Date of Test**: ____________________
- **Unraid Version**: ____________________
- **Status**: (PASS / FAIL)
