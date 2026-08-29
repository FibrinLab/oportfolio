# Diary export and lifecycle contract

## Portable ZIP

Every export is a point-in-time copy owned and downloadable only by the fellow. It contains:

```text
README.txt
diary.pdf
diary.json
manifest.json
checksums.sha256
attachments/<entry-id>/<original-name>
```

`diary.pdf` is the human-readable copy. `diary.json` is the portable, UTF-8,
schema-versioned record (`schemaVersion: 1.0.0`). The manifest lists the media type, byte
size and SHA-256 value for every payload file. `checksums.sha256` also covers the manifest.
Attachment bytes are streamed from the clean bucket and verified against their stored size
and checksum while the ZIP is built.

Included content is the export-time state of every retained active or archived entry,
activity/creation/update dates, rich-text document and plain text, optional entry type,
active curriculum links, HTTPS links and clean attachments. Deleted entries, revision
history, sessions, audit/security logs and internal object keys are excluded.

An export is rejected while any retained attachment is not clean or lacks a detected media
type/checksum. Standard archive objects and their database snapshots expire after seven
days. Download links are signed for at most five minutes.

## Finish, reopen and deletion

Finishing requires the fellow to type `FINISH MY DIARY`. In one transaction it:

1. changes the diary from `open` to `finished` and makes entries read-only;
2. increments a finish-cycle number;
3. snapshots and queues a final ZIP;
4. schedules neutral reminders 30, 7 and 1 day before deletion; and
5. schedules deletion 90 days after finishing.

The fellow may type `REOPEN MY DIARY` before the deadline. This restores editing,
supersedes and removes that cycle's final export, and makes its reminders/purge messages
no-ops. Finishing again starts a fresh 90-day cycle and creates a fresh final copy.

At the deadline the worker will purge only when the matching finish cycle is still
finished, no active retention hold exists, and its final ZIP was successfully generated.
The guarded database function deletes diary entries (including archived and grace-period
deleted rows), revisions, mappings, links and attachment metadata; export snapshots and
objects are scrubbed too. Hash-chained security audit records remain but contain no diary
narrative or titles.

Tenant administrators may place or release an exceptional retention hold with a recorded
reason. Staff cannot use a hold to read the diary. Releasing an overdue hold immediately
queues the guarded purge.
