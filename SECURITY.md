# Security Policy

## Supported versions

Only the latest version of pipcondition is actively maintained.

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Send a description of the issue to **wasath.vt@gmail.com** with the subject line `[SECURITY] pipcondition`.

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix if you have one

You will receive a response within 72 hours. If the issue is confirmed, a fix will be prioritised and a patched release will be made as soon as possible.

## Scope

pipcondition simulates Azure Pipelines YAML locally in the browser - pasted or dropped pipeline files, mock variables/parameters, and simulated run state are never sent to a server. The main security surface for that part of the app is client-side: XSS and any code path that could execute untrusted YAML content as anything other than data.

The one exception is the optional Azure DevOps REST API integration (`src/app/api/ado/*`), which lets you fetch a real pipeline's YAML using a Personal Access Token. That token is handled server-only:

- The PAT is submitted once to a Next.js Route Handler and never returned in any API response.
- It is encrypted (AES-256-GCM) before being stored in an httpOnly, secure, `sameSite=strict` session cookie - the raw token is never persisted to disk or a database.
- Client-side code only ever talks to pipcondition's own `/api/ado/*` routes, never directly to `dev.azure.com`.

If you find a way the PAT could leak to the client, to logs, or to disk, that's a high-priority report - please use the process above.
