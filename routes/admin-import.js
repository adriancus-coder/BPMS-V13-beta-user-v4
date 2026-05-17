'use strict';

const { XMLParser } = require('fast-xml-parser');

const RESURSE_CRESTINE_HOST = 'www.resursecrestine.ro';
const FETCH_TIMEOUT_MS = 10000;

/**
 * Try to extract a song ID from a resursecrestine.ro URL.
 * Valid formats:
 *   https://www.resursecrestine.ro/cantece/<id>/<slug>
 *   https://www.resursecrestine.ro/cantece/<id>
 * Returns id (string) or null.
 */
function extractResurseCrestineSongId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== RESURSE_CRESTINE_HOST) return null;
    const match = parsed.pathname.match(/^\/cantece\/(\d+)(\/|$)/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch + parse Opensong XML from resursecrestine.ro
 * Returns { title, author, text, sourceUrl, sourceProvider } or throws.
 */
async function fetchResurseCrestineSong(songId) {
  const url = `https://${RESURSE_CRESTINE_HOST}/cantece/opensong/${songId}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'SanctuaryVoice/1.0 (church translation app)',
        'Accept': 'application/xml, text/xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Fetch timed out (resursecrestine.ro did not respond)');
    }
    throw new Error(`Fetch failed: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const xmlText = await res.text();

  if (xmlText.length < 50) {
    throw new Error('Response too short, likely not a valid song XML');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,  // keep lyrics as raw string
    trimValues: false,     // preserve line breaks in lyrics
  });

  let parsed;
  try {
    parsed = parser.parse(xmlText);
  } catch (err) {
    throw new Error(`XML parse error: ${err.message}`);
  }

  if (!parsed || !parsed.song) {
    throw new Error('Expected <song> root element not found in XML');
  }

  const song = parsed.song;
  const title = String(song.title || '').trim();
  const author = String(song.author || '').trim();
  let lyrics = String(song.lyrics || '').trim();

  if (!title || !lyrics) {
    throw new Error('Missing required fields: title or lyrics');
  }

  // Normalize Opensong markers to plain text:
  // [V1], [V2] -> blank line; [C] -> "Refren:"; strip other markers.
  lyrics = lyrics
    .replace(/^\s*\[V\d+\]\s*\n?/gm, '\n')        // verse markers -> blank line
    .replace(/^\s*\[C\]\s*\n?/gm, '\nRefren:\n')  // chorus marker -> "Refren:"
    .replace(/^\s*\[B\d*\]\s*\n?/gm, '\n')         // bridge markers
    .replace(/^\s*\[P\]\s*\n?/gm, '\n')            // pre-chorus
    .replace(/^\s*\[\w+\]\s*\n?/gm, '\n')          // any other [X]
    .replace(/\n{3,}/g, '\n\n')                    // collapse multiple blanks
    .trim();

  return {
    title,
    author,
    text: lyrics,
    sourceUrl: `https://${RESURSE_CRESTINE_HOST}/cantece/${songId}`,
    sourceProvider: 'resursecrestine.ro',
  };
}

/**
 * Dispatch URL to appropriate parser.
 * Throws "Unsupported URL" if no provider matches.
 */
async function importFromUrl(url) {
  const songId = extractResurseCrestineSongId(url);
  if (songId) {
    return await fetchResurseCrestineSong(songId);
  }

  // Future providers go here

  throw new Error(`Unsupported URL. Currently supported: ${RESURSE_CRESTINE_HOST}/cantece/<id>/...`);
}

const RESURSE_CRESTINE_SEARCH_BASE = `https://${RESURSE_CRESTINE_HOST}/web-api-search`;

/**
 * Search songs on resursecrestine.ro by title using their official public API.
 * Documented at https://www.resursecrestine.ro/web-api
 *
 * search_in=2 scopes the search to "cantece" (songs); other values return
 * Bible verses etc. Response shape (verified): { "Results": [ { id, title,
 * title_slug, author, kind, slug } ] } where slug is the category ("cantece").
 *
 * Returns array of { id, title, author, url } (max 20 results).
 * Throws on network/parse errors.
 */
async function searchResurseCrestineSongs(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    throw new Error('Empty search query');
  }
  if (trimmed.length < 2) {
    throw new Error('Search query too short (min 2 chars)');
  }

  const url = new URL(RESURSE_CRESTINE_SEARCH_BASE);
  url.searchParams.set('search_text', trimmed);
  url.searchParams.set('search_in', '2');            // 2 = cantece (songs)
  url.searchParams.set('search_by', 'filtru-titlu'); // search in title only
  url.searchParams.set('output', 'json2');

  let res;
  try {
    res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SanctuaryVoice/1.0 (church translation app)',
        'Accept': 'application/json',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Search timed out (resursecrestine.ro did not respond)');
    }
    throw new Error(`Search request failed: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Search request failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Search response parse error: ${err.message}`);
  }

  let items = [];
  if (Array.isArray(data?.Results)) {
    items = data.Results;
  } else if (Array.isArray(data?.results)) {
    items = data.results;
  } else if (Array.isArray(data)) {
    items = data;
  } else {
    throw new Error(`Unexpected response shape (keys: ${Object.keys(data || {}).join(', ') || 'none'})`);
  }

  // Keep only numeric song ids in the "cantece" category — those are the ones
  // that yield importable /cantece/<id>/<slug> URLs for the V16 import flow.
  return items
    .map((item) => ({
      id: String(item.id || '').trim(),
      title: String(item.title || '').trim(),
      author: String(item.author || '').trim(),
      titleSlug: String(item.title_slug || '').trim(),
      category: String(item.slug || '').trim(),
    }))
    .filter((item) => item.id && /^\d+$/.test(item.id) && item.title && item.category === 'cantece')
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author,
      url: `https://${RESURSE_CRESTINE_HOST}/cantece/${item.id}/${item.titleSlug || 'cantec'}`,
    }));
}

module.exports = {
  importFromUrl,
  extractResurseCrestineSongId,
  searchResurseCrestineSongs,
};
