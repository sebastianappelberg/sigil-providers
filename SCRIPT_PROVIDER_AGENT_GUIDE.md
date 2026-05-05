# Script Provider Agent Guide

This guide is for agents that must create or update a script provider in `providers.json`.

## Goal

Create a valid script provider entry that the app can load and execute.

## File Location

`providers.json` lives in app-data:

- Windows: `%APPDATA%\com.sebastianappelberg.sigil\providers.json`
- macOS: `~/Library/Application Support/com.sebastianappelberg.sigil/providers.json`
- Linux: `~/.local/share/com.sebastianappelberg.sigil/providers.json`

## Required Top-Level Conditions

1. Set `"allowUnsafeScriptProviders": true` at the root of `providers.json`.
2. In the script provider object, set `"allowUnsafe": true`.
3. Use a unique provider `id` not reserved by internal providers:
- `folder`
- `applications`

## Preferred Script Provider Schema

`providers.json` is a single JSON object. For script providers, use this top-level shape:

```json
{
  "version": 1,
  "allowUnsafeScriptProviders": true,
  "providers": [
    {
      "type": "script",
      "id": "mytool",
      "name": "My Tool",
      "commands": {
        "search": {
          "command": "C:\\tools\\my-provider.exe",
          "args": ["--query", "{query}"],
          "env": {
            "MY_QUERY": "{query}"
          },
          "cwd": "C:\\tools",
          "timeoutMs": 3000
        },
        "open": {
          "command": "C:\\tools\\my-provider-open.exe",
          "args": ["--open", "{query}"],
          "env": {
            "MY_ACTION": "open"
          },
          "cwd": "C:\\tools",
          "timeoutMs": 3000
        }
      },
      "timeoutMs": 3000,
      "aliases": ["mt"],
      "icon": "simple:github",
      "debounceMs": 50,
      "voiceEnabled": true,
      "allowUnsafe": true
    }
  ]
}
```

The script provider object itself has this shape:

```json
{
  "type": "script",
  "id": "mytool",
  "name": "My Tool",
  "commands": {
    "search": {
      "command": "C:\\tools\\my-provider.exe",
      "args": ["--query", "{query}"],
      "env": {
        "MY_QUERY": "{query}"
      },
      "cwd": "C:\\tools",
      "timeoutMs": 3000
    },
    "open": {
      "command": "C:\\tools\\my-provider-open.exe",
      "args": ["--open", "{query}"],
      "env": {
        "MY_ACTION": "open"
      },
      "cwd": "C:\\tools",
      "timeoutMs": 3000
    }
  },
  "timeoutMs": 3000,
  "aliases": ["mt"],
  "icon": "simple:github",
  "debounceMs": 50,
  "voiceEnabled": true,
  "allowUnsafe": true
}
```

### Top-Level `providers.json` Fields

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `version` | number | No | `0` when omitted | Config schema marker. Use `1` for new files. |
| `allowUnsafeScriptProviders` | boolean | Yes for script providers | `false` | Must be `true`, otherwise every script provider is skipped. |
| `providers` | array | Yes | `[]` | List of provider objects. Script entries require `"type": "script"`. |

### Script Provider Object Fields

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `type` | string | Yes | None | Must be exactly `"script"`. |
| `id` | string | Yes | None | Unique provider id. After trimming, must match `[A-Za-z0-9_-]+`. |
| `name` | string | Yes | None | Display name. Empty or whitespace-only names load as the `id`; agents should still write a non-empty name. |
| `commands` | object | Preferred | None | Map from action name to command object. Must contain `search` unless legacy `command` is used. |
| `timeoutMs` | number | No | `3000` | Provider-level default timeout for commands that omit `timeoutMs`. Effective value is clamped. |
| `aliases` | string array | No | `[]` | Extra provider names. Empty aliases are removed; duplicate aliases are removed case-insensitively. |
| `icon` | string | No | generic icon | Icon hint. Supports `simple:<slug>`, data URI, URL, absolute path, `file://`, or path relative to the app-data directory. |
| `debounceMs` | number | No | `50` | Query debounce in milliseconds. Clamped to `0..1000`. |
| `voiceEnabled` | boolean | No | `true` | Whether voice activation can select this provider. |
| `allowUnsafe` | boolean | Yes for script providers | `false` | Must be `true`, otherwise this script provider is skipped. |

Do not rely on implicit type coercion. JSON values must have the exact types above. For example, `"3000"` is invalid for `timeoutMs`; use `3000`.

## Command Rules

Each value in `commands` must be a command object:

```json
{
  "command": "C:\\tools\\my-provider.exe",
  "args": ["--query", "{query}"],
  "env": {
    "MY_QUERY": "{query}"
  },
  "cwd": "C:\\tools",
  "timeoutMs": 3000
}
```

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `command` | string | Yes | None | Executable/program to run. Trimmed value must be non-empty. |
| `args` | string array | No | `[]` | Process arguments. Each entry is passed as one argument. |
| `env` | object of string values | No | `{}` | Additional environment variables for the process. Keys and values must be strings. |
| `cwd` | string | No | inherited app working directory | Working directory for the process. |
| `timeoutMs` | number | No | provider `timeoutMs`, else `3000` | Timeout for this action. Effective value is clamped to `300..10000`. |

Rules:

1. `commands.search` is required unless using legacy top-level `command`. New providers must use `commands.search`.
2. `commands.open` is optional. If present, the provider owns open behavior.
3. Action keys are trimmed and lowercased by the app. `"Search"` and `" search "` both become `search`.
4. Empty action keys are invalid and cause the provider to be skipped.
5. Additional action keys are accepted for future expansion, but only `search` and `open` are used by current app flows.
6. The command is run as a process with arguments, not as a shell command string. Put flags and values in `args`.
7. On Windows, if direct execution fails because the program cannot be resolved, the app also attempts `cmd`, `pwsh`, and `powershell` command resolution fallbacks.
8. Non-zero exit status fails the action. The user-visible error uses `stderr` when present, otherwise `stdout`, otherwise the exit status.

## Interpolation + Environment

`{query}` interpolation is a raw string replacement, not URL encoding and not shell escaping. It happens in:

- `commands.<action>.command`
- `commands.<action>.args[]`
- `commands.<action>.env` values
- `commands.<action>.cwd`

Environment added by runtime:

- For all actions:
  - `SIGIL_ACTION=<actionName>`
  - `SIGIL_QUERY=<query>`
- For `open` action:
  - `SIGIL_CONTEXT_ID`
  - `SIGIL_PRIVATE_MODE` (`true` or `false`)
  - `SIGIL_RESULT_JSON` (selected result as JSON string)

If a configured `env` key conflicts with a runtime key such as `SIGIL_QUERY`, the runtime value wins.

## Search Output Contract

`commands.search` must write a JSON array to stdout and exit with status `0`. Stderr may contain diagnostics, but any non-zero status fails the search.

Exact result object shape:

```json
{
  "id": "result-1",
  "title": "Open Docs",
  "description": "Example result",
  "url": "https://example.com/docs",
  "path": "C:\\work\\project",
  "icon": "simple:github",
  "metadata": "opaque provider-specific string"
}
```

Example stdout:

```json
[
  {
    "id": "result-1",
    "title": "Open Docs",
    "description": "Example result",
    "url": "https://example.com/docs"
  },
  {
    "title": "Open Folder",
    "path": "C:\\work\\project"
  }
]
```

Recognized result fields:

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | string | Yes | None | Display title. After trimming, must be non-empty or the result is dropped. |
| `id` | string | No | `<providerId>-<zeroBasedIndex>` | Stable result id. Used to re-match the selected result before opening. Empty ids use the default. |
| `description` | string | No | `"Script result"` | Secondary display text. Empty values use the default. |
| `url` | string | Conditionally | None | Native URL open target. Empty values are ignored. |
| `path` | string | Conditionally | None | Native file/folder path open target. Empty values are ignored. |
| `icon` | string | No | provider icon | Per-result icon hint. Empty values are ignored. |
| `metadata` | string | No | None | Opaque string passed through to `SIGIL_RESULT_JSON`. Must be a string, not an object. |

Target requirement:

- If `commands.open` is absent: each result must include `url` or `path`.
- If `commands.open` is present: `url`/`path` may be omitted.

Filtering behavior:

- Results with missing, null, or whitespace-only `title` are dropped.
- When `commands.open` is absent, results without a non-empty `url` or `path` are dropped.
- Unknown result fields are ignored.
- Invalid JSON, a non-array JSON value, or wrong field types for recognized fields fails the whole search.

## Open Behavior

When `commands.open` exists:

1. Provider is treated as provider-managed-open.
2. Open flow calls provider open command first.
3. If open command fails, open fails directly (no native `url/path` fallback).
4. Before opening, the app may re-run search for the current query and resolve the selected result by `id`; if the id no longer exists, provider-managed open fails.

When `commands.open` does not exist:

1. Native open uses `url`/`path` first.
2. `url` is preferred over `path` when both are present.
3. Because search results without `url`/`path` are dropped, a valid search-only provider must always return at least one native target per result.

## Legacy Fallback Fields

The preferred schema is `commands`. Legacy fields are still accepted only as fallback:

| Legacy field | Equivalent preferred field |
| --- | --- |
| `command` | `commands.search.command` |
| `args` | `commands.search.args` |
| `env` | `commands.search.env` |
| `cwd` | `commands.search.cwd` |
| `openCommand` | `commands.open.command` |
| `openArgs` | `commands.open.args` |
| `openEnv` | `commands.open.env` |
| `openCwd` | `commands.open.cwd` |
| `openTimeoutMs` | `commands.open.timeoutMs` |

Agents should not create new providers with legacy fields. If both `commands.search` and legacy `command` exist, `commands.search` wins. If both `commands.open` and legacy `openCommand` exist, `commands.open` wins.

## Agent Workflow

1. Read current `providers.json`.
2. Ensure root `allowUnsafeScriptProviders` is `true`.
3. Ensure no duplicate provider `id`.
4. Insert or update provider object with preferred `commands` schema.
5. Validate JSON syntax.
6. Validate command paths are non-empty strings.
7. Validate `commands.search` exists.
8. Validate `allowUnsafe` is `true`.
9. Save file and rely on app hot reload.

## Quick Validation Checklist

- Root has `"allowUnsafeScriptProviders": true`.
- Provider has `"type": "script"`.
- Provider `id` is non-empty and matches `[A-Za-z0-9_-]+`.
- Provider has `"commands"` with `"search"`.
- Every configured action has non-empty `command`.
- Search stdout is valid JSON array.
- Result objects all have non-empty `title`.
- If no `commands.open`, each result has `url` or `path`.

## Minimal Templates

Search-only provider:

```json
{
  "type": "script",
  "id": "mytool",
  "name": "My Tool",
  "commands": {
    "search": {
      "command": "C:\\tools\\my-provider.exe",
      "args": ["{query}"]
    }
  },
  "allowUnsafe": true
}
```

Search + open provider:

```json
{
  "type": "script",
  "id": "mytool",
  "name": "My Tool",
  "commands": {
    "search": {
      "command": "C:\\tools\\my-provider.exe",
      "args": ["{query}"]
    },
    "open": {
      "command": "C:\\tools\\my-provider-open.exe"
    }
  },
  "allowUnsafe": true
}
```
