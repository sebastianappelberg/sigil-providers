#!/usr/bin/env node
const https = require('https');

const ENDPOINT = 'https://journeyplanner.integration.sl.se/v2/stop-finder';
const ORIGIN_NAME = 'Ekstubben (Nacka)';
const ORIGIN_PLACE_ID = 'OTA5MTAwMTAwMDAwNDYwNA==';
const TRANSPORT_TYPES = ['METRO', 'TRAIN', 'TRAM', 'SHIP', 'BUS', 'LOCALBUS'];
const MAX_RESULTS = 10;
const REQUEST_TIMEOUT_MS = 4000;

function logErr(message) {
  process.stderr.write(`[sl-provider] ${message}\n`);
}

function writeResults(results) {
  process.stdout.write(JSON.stringify(results));
}

function buildLookupUrl(query) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('name_sf', query);
  url.searchParams.set('type_sf', 'any');
  url.searchParams.set('any_obj_filter_sf', '46');
  return url;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`SL stop-finder returned HTTP ${res.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('SL stop-finder returned invalid JSON'));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('SL stop-finder request timed out'));
    });
    req.on('error', reject);
  });
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDestinationName(location) {
  const baseName = asTrimmedString(location.disassembledName) || asTrimmedString(location.name);
  if (!baseName) return '';

  const parentName =
    location.parent && typeof location.parent === 'object'
      ? asTrimmedString(location.parent.name)
      : '';

  if (!parentName || parentName === baseName) {
    return baseName;
  }

  return `${baseName} (${parentName})`;
}

function toPlaceId(locationId) {
  return Buffer.from(String(locationId), 'utf8').toString('base64');
}

function buildSlUrl(destPlaceId, destName) {
  const params = new URLSearchParams();
  params.set('timeType', 'NOW');
  params.set('destPlaceId', destPlaceId);
  params.set('origPlaceId', ORIGIN_PLACE_ID);
  params.set('destName', destName);
  params.set('origName', ORIGIN_NAME);
  params.set('transportTypes', JSON.stringify(TRANSPORT_TYPES));
  return `https://sl.se/?${params.toString()}`;
}

function toResult(location) {
  if (!location || typeof location !== 'object' || location.id == null) {
    return null;
  }

  const destName = formatDestinationName(location);
  if (!destName) return null;

  const destPlaceId = toPlaceId(location.id);
  return {
    id: `sl::${destPlaceId}`,
    title: destName,
    description: `Travel from ${ORIGIN_NAME}`,
    url: buildSlUrl(destPlaceId, destName),
  };
}

async function search(rawQuery) {
  const query = asTrimmedString(rawQuery);
  if (query.length < 2) {
    return [];
  }

  const data = await requestJson(buildLookupUrl(query));
  if (!Array.isArray(data.locations)) {
    throw new Error('SL stop-finder response did not include locations');
  }

  return data.locations
    .map(toResult)
    .filter(Boolean)
    .slice(0, MAX_RESULTS);
}

async function main() {
  const action = process.argv[2];
  const query = process.argv[3] || '';

  if (action !== 'search') {
    logErr(`Invalid action: ${action || '(missing)'}`);
    process.exit(1);
  }

  try {
    writeResults(await search(query));
  } catch (err) {
    logErr(err && err.message ? err.message : String(err));
    writeResults([]);
  }
}

main();
