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

module.exports = {
  importFromUrl,
  extractResurseCrestineSongId,
};
