# Provider Repositories

Provider repositories let you publish installable Sigil providers from a GitHub repository. Users add the repository in Settings, refresh its catalog, then install or update individual providers.

## Repository Layout

Sigil accepts GitHub repository URLs. The manifest can live in either of these default locations:

- `sigil-providers.json`
- `.sigil/providers.json`

You can also add a GitHub tree URL to point Sigil at a subdirectory:

```text
https://github.com/owner/repo/tree/main/catalog
```

With that URL, Sigil looks for:

- `catalog/sigil-providers.json`
- `catalog/.sigil/providers.json`

For predictable installs, prefer a branch URL such as `/tree/main/...` instead of the plain repository URL. Plain repository URLs fetch raw files from GitHub `HEAD`.

## Manifest Shape

Create a manifest with this top-level shape:

```json
{
  "schemaVersion": 1,
  "providers": [
    {
      "type": "url",
      "id": "example-docs",
      "name": "Example Docs",
      "version": "1.0.0",
      "description": "Search Example documentation",
      "sourceUrl": "https://github.com/owner/repo/tree/main/catalog",
      "urlTemplate": "https://example.com/search?q={query}",
      "aliases": ["docs"],
      "icon": "simple:readthedocs",
      "debounceMs": 0,
      "voiceEnabled": true,
      "titleTemplate": "Search Example Docs for \"{query}\""
    }
  ]
}
```

Required manifest fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | number | Must be `1`. |
| `providers` | array | One or more provider objects. |

Provider ids must be unique within the manifest, must match `[A-Za-z0-9_-]+`, and cannot be `folder` or `applications`.

Provider versions must be semantic versions with three numeric parts, for example `1.0.0`. Sigil uses the version to detect updates.

## URL Providers

Use a URL provider when a service can be searched with a URL.

```json
{
  "type": "url",
  "id": "github-code",
  "name": "GitHub Code",
  "version": "1.0.0",
  "description": "Search GitHub",
  "urlTemplate": "https://github.com/search?q={query}",
  "aliases": ["code"],
  "icon": "simple:github"
}
```

URL provider fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `type` | string | Yes | Must be `"url"`. |
| `id` | string | Yes | Stable provider id. |
| `name` | string | Yes | Display name. |
| `version` | string | Yes | Semantic version such as `1.0.0`. |
| `urlTemplate` | string | Yes | Search URL. Must include `{query}`. |
| `description` | string | No | Catalog and provider description. |
| `sourceUrl` | string | No | Source link shown in the UI. Defaults to the repository URL. |
| `aliases` | string array | No | Extra names for selecting the provider. |
| `icon` | string | No | Supports `simple:<slug>`, data URIs, URLs, or paths. |
| `debounceMs` | number | No | Query debounce in milliseconds. |
| `voiceEnabled` | boolean | No | Whether voice activation can select this provider. |
| `titleTemplate` | string | No | Result title template. |

## Script Providers

Script providers run local commands after the user explicitly confirms installation. Repository-installed scripts do not require users to enable the global `allowUnsafeScriptProviders` setting; Sigil marks only the installed repository script as allowed.

Script provider files are resolved relative to the manifest file, then downloaded into Sigil app data under `provider-repositories/<repository-id>/<provider-id>/`. Use `{providerDir}` in commands, arguments, environment values, working directories, and icons to refer to that install directory.

Example repository layout:

```text
sigil-providers.json
providers/npm-search/index.js
providers/npm-search/icon.svg
```

Example manifest entry:

```json
{
  "type": "script",
  "id": "npm-search",
  "name": "npm Search",
  "version": "1.0.0",
  "description": "Search npm packages",
  "files": [
    "providers/npm-search/index.js",
    "providers/npm-search/icon.svg"
  ],
  "commands": {
    "search": {
      "command": "node",
      "args": ["{providerDir}/providers/npm-search/index.js", "{query}"],
      "timeoutMs": 5000
    }
  },
  "icon": "{providerDir}/providers/npm-search/icon.svg",
  "aliases": ["npm"]
}
```

Script provider fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `type` | string | Yes | Must be `"script"`. |
| `id` | string | Yes | Stable provider id. |
| `name` | string | Yes | Display name. |
| `version` | string | Yes | Semantic version such as `1.0.0`. |
| `files` | string array | No | Files to download, relative to the manifest file. Paths cannot be absolute or contain `..` or backslashes. |
| `commands` | object | Yes | Must include `search`. |
| `description` | string | No | Catalog and provider description. |
| `sourceUrl` | string | No | Source link shown in the UI. Defaults to the repository URL. |
| `aliases` | string array | No | Extra names for selecting the provider. |
| `icon` | string | No | Can use `{providerDir}` for downloaded icons. |
| `debounceMs` | number | No | Query debounce in milliseconds. |
| `voiceEnabled` | boolean | No | Whether voice activation can select this provider. |

Each command entry has this shape:

```json
{
  "command": "node",
  "args": ["{providerDir}/providers/npm-search/index.js", "{query}"],
  "env": {
    "EXAMPLE": "value"
  },
  "cwd": "{providerDir}",
  "timeoutMs": 5000
}
```

`commands.search.command` must be non-empty. `commands.open` is optional and follows the same command-object shape. For the search result JSON contract, see [SCRIPT_PROVIDER_AGENT_GUIDE.md](./SCRIPT_PROVIDER_AGENT_GUIDE.md).

## Publishing And Updating

1. Create a GitHub repository or a catalog subdirectory in an existing repository.
2. Add `sigil-providers.json` or `.sigil/providers.json`.
3. Add one or more providers with unique ids and semantic versions.
4. For script providers, list every file Sigil must download in `files`.
5. Commit and push the manifest and any script assets.
6. In Sigil, open Settings, add the GitHub repository URL, refresh the repository, then install a provider.

To publish an update, change the provider entry and bump its `version`. Sigil shows an update when the manifest version is greater than the installed version.

Removing a repository from Settings only removes the catalog source. Already installed repository providers remain installed and can be removed from the normal Providers list.

## Validation Checklist

- Manifest JSON is valid.
- `schemaVersion` is `1`.
- `providers` is non-empty.
- Every provider id is unique and matches `[A-Za-z0-9_-]+`.
- Every provider version has three numeric semantic-version parts.
- URL providers include `{query}` in `urlTemplate`.
- Script providers include `commands.search.command`.
- Script `files` paths are relative and do not use `..`, absolute paths, or backslashes.
