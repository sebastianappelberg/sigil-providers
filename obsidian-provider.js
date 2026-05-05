#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LOG_FILE = path.join(__dirname, 'obsidian-provider.log');

function nowIso() {
  return new Date().toISOString();
}

function appendLog(level, msg) {
  const line = `[${nowIso()}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {
    // Avoid crashing the provider if logging fails.
  }
}

function logErr(msg) {
  const line = `[obsidian-provider] ${msg}`;
  process.stderr.write(`${line}\n`);
  appendLog('ERROR', msg);
}

function logInfo(msg) {
  console.log(msg);
  // Intentionally no-op: only error events should be written to file.
  void msg;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getVaults() {
  const appData = process.env.APPDATA || '';
  const configPath = path.join(appData, 'obsidian', 'obsidian.json');
  if (!fs.existsSync(configPath)) {
    logInfo(`Obsidian config not found at: ${configPath}`);
    return [];
  }

  const config = safeReadJson(configPath);
  if (!config || !config.vaults || typeof config.vaults !== 'object') {
    logInfo(`Obsidian config invalid or vault list missing: ${configPath}`);
    return [];
  }

  const vaults = [];
  for (const [vaultId, info] of Object.entries(config.vaults)) {
    if (!info || typeof info.path !== 'string' || !info.path.trim()) continue;
    const vaultPath = info.path;
    try {
      if (!fs.statSync(vaultPath).isDirectory()) continue;
    } catch {
      logInfo(`Skipping vault path (not accessible): ${vaultPath}`);
      continue;
    }

    vaults.push({
      vaultId,
      vaultPath,
      vaultName: (typeof info.name === 'string' && info.name.trim()) || path.basename(vaultPath),
    });
  }

  return vaults;
}

function walkFiles(rootDir, onFile) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        if (lowerName === '.obsidian' || lowerName === '.trash') continue;
        stack.push(full);
      } else if (entry.isFile()) {
        onFile(full);
      }
    }
  }
}

function buildSearchResults(rawQuery) {
  const q = (rawQuery || '').trim();
  if (!q) {
    logInfo('Search called with empty query.');
    return [];
  }

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const queryLower = q.toLowerCase();
  const vaults = getVaults();
  if (vaults.length === 0) {
    logInfo(`Search query="${q}" has no available vaults.`);
    return [];
  }

  logInfo(`Search start query="${q}" vaultCount=${vaults.length}`);

  const matches = [];

  for (const vault of vaults) {
    walkFiles(vault.vaultPath, (fullPath) => {
      const ext = path.extname(fullPath).toLowerCase();
      if (ext !== '.md' && ext !== '.canvas') return;

      const rel = path.relative(vault.vaultPath, fullPath);
      const relNorm = rel.replace(/\//g, '\\');
      const relLower = relNorm.toLowerCase();
      const base = path.basename(fullPath, ext);
      const baseLower = base.toLowerCase();

      for (const token of tokens) {
        if (!baseLower.includes(token) && !relLower.includes(token)) return;
      }

      let rank = 4;
      if (baseLower === queryLower) rank = 1;
      else if (baseLower.startsWith(queryLower)) rank = 2;
      else if (baseLower.includes(queryLower)) rank = 3;

      matches.push({
        rank,
        titleSort: baseLower,
        relSort: relLower,
        result: {
          id: `obsidian::${vault.vaultId}::${relNorm}`,
          title: base,
          description: `${vault.vaultName} • ${relNorm}`,
          path: fullPath,
        },
      });
    });
  }

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.titleSort < b.titleSort) return -1;
    if (a.titleSort > b.titleSort) return 1;
    if (a.relSort < b.relSort) return -1;
    if (a.relSort > b.relSort) return 1;
    return 0;
  });

  const results = matches.slice(0, 75).map((m) => m.result);
  logInfo(`Search done query="${q}" rawMatches=${matches.length} returned=${results.length}`);
  return results;
}

function openResult() {
  const raw = process.env.SIGIL_RESULT_JSON;
  if (!raw || !raw.trim()) {
    throw new Error('SIGIL_RESULT_JSON is missing.');
  }

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error('SIGIL_RESULT_JSON is not valid JSON.');
  }

  const metadataPath =
    result &&
    result.metadata &&
    typeof result.metadata === 'object' &&
    typeof result.metadata.path === 'string'
      ? result.metadata.path
      : '';
  const targetPath = (result && result.path) || metadataPath;
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Result path is missing.');
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Result path does not exist: ${targetPath}`);
  }

  const uri = `obsidian://open?path=${encodeURIComponent(targetPath)}`;
  logInfo(`Open start targetPath="${targetPath}"`);
  const child = spawn('cmd.exe', ['/c', 'start', '', uri], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  logInfo(`Open dispatched targetPath="${targetPath}"`);
}

function main() {
  const action = process.argv[2];
  const query = process.argv[3] || '';
  logInfo(`Invoke action="${action || ''}" query="${query}"`);

  if (action !== 'search' && action !== 'open') {
    logErr(`Invalid action: ${action || '(missing)'}`);
    process.exit(1);
  }

  try {
    if (action === 'search') {
      const results = buildSearchResults(query);
      process.stdout.write(JSON.stringify(results));
      return;
    }

    openResult();
  } catch (err) {
    logErr(err && err.message ? err.message : String(err));
    if (err && err.stack) {
      appendLog('ERROR', `Stack: ${err.stack}`);
    }
    process.exit(1);
  }
}

main();
