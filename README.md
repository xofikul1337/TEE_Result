# SSC 2026 Result Portal

Single-input, mobile-first result checker using Firebase Realtime Database.

The private source data can remain a root-level list, but the browser reads only
`/publicResults/{roll-or-registration-id}`. Each public result contains exactly
`status` and, only for selected students, `name`; phone numbers, emails, marks,
and other registration fields are never returned to the browser.

Supported status values are `SELECTED`, `NOT SELECTED`, `PENDING`, `WAITING`,
`CANCELLED`, and `CANCEL`. Status matching is case-insensitive. An unknown roll
is shown as not selected.

Generate the safe import file from a TableConvert export:

```powershell
.\scripts\build-public-results.ps1 -InputPath "C:\path\to\results.json" -OutputPath ".\public-results.json"
```

In Firebase Console, import `public-results.json` at the `/publicResults` node,
then publish `database.rules.json` in Realtime Database Rules. The rules deny
all root/private reads and writes while allowing only direct reads of individual
public result records. Serve this directory through HTTP to test it; opening
`index.html` as a `file://` URL will not load JavaScript modules.
