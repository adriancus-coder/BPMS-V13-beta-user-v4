#!/usr/bin/env node
/**
 * Generate CHANGELOG.md from git log.
 *
 * Parses commit subjects for version-tagged patterns used in this repo:
 *   - "BUGFIX V7.1: ..."  -> grouped under V7
 *   - "V11.2: ..."        -> grouped under V11
 *   - "Smart Flush V2: ..." -> grouped under "Smart Flush"
 *   - "HOTFIX V7.1: ..."  -> grouped under V7
 *
 * Untagged commits go to "Other" at the bottom.
 *
 * Usage:
 *   node scripts/generate-changelog.js                # writes CHANGELOG.md in repo root
 *   node scripts/generate-changelog.js --stdout       # prints to stdout instead
 *   node scripts/generate-changelog.js --since v1.0   # only commits after a ref
 *
 * Re-run anytime; safe to commit the output.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const toStdout = args.includes('--stdout');
const sinceIdx = args.indexOf('--since');
const sinceRef = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

// Format: hash \x1f subject \x1f authorName \x1f isoDate \x1e
const SEP_FIELD = '\x1f';
const SEP_RECORD = '\x1e';

function getCommits() {
  const range = sinceRef ? `${sinceRef}..HEAD` : '';
  const cmd = [
    'git', 'log',
    `--pretty=format:%H${SEP_FIELD}%s${SEP_FIELD}%an${SEP_FIELD}%aI${SEP_RECORD}`,
    range,
  ].filter(Boolean).join(' ');

  const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return raw
    .split(SEP_RECORD)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, subject, author, date] = r.split(SEP_FIELD);
      return { hash, subject, author, date };
    });
}

// Match patterns like:
//   BUGFIX V7.1:    -> {prefix: 'BUGFIX', major: 7, minor: 1, rest: ...}
//   HOTFIX V7.1:    -> {prefix: 'HOTFIX', major: 7, minor: 1}
//   V11.2:          -> {prefix: '', major: 11, minor: 2}
//   V10.1 U1:       -> {prefix: '', major: 10, minor: 1, rest: 'U1: ...'}
//   Smart Flush V2: -> {prefix: 'Smart Flush', major: 2, minor: null}
//   Bible Mode V3.3:-> {prefix: 'Bible Mode', major: 3, minor: 3}
//   Song Mode Overhaul: -> doesn't match version, goes to Other or special bucket
const VERSION_RE = /^(BUGFIX|HOTFIX|Smart Flush|Bible Mode|Song Mode|Song Overhaul)?\s*V(\d+)(?:\.(\d+))?(?:\s+(?:fix(?:es)?\s+)?([A-Z]\d+(?:\+[A-Z]\d+)?))?:?\s*(.*)$/i;

function classify(commit) {
  const m = commit.subject.match(VERSION_RE);
  if (!m) return { bucket: 'Other', sortKey: [0, 0], commit };

  const prefix = (m[1] || '').trim();
  const major = parseInt(m[2], 10);
  const minor = m[3] ? parseInt(m[3], 10) : 0;
  const subTag = m[4] || '';
  const rest = m[5] || commit.subject;

  let bucketName;
  if (prefix && /^(Smart Flush|Bible Mode|Song Mode|Song Overhaul)$/i.test(prefix)) {
    bucketName = `${prefix} V${major}`;
  } else {
    bucketName = `V${major}`;
  }

  return {
    bucket: bucketName,
    sortKey: [major, minor, subTag],
    label: `V${major}${m[3] ? '.' + m[3] : ''}${subTag ? ' ' + subTag : ''}`,
    prefix,
    rest,
    commit,
  };
}

function groupByBucket(commits) {
  const groups = new Map();
  for (const c of commits) {
    const classified = classify(c);
    if (!groups.has(classified.bucket)) groups.set(classified.bucket, []);
    groups.get(classified.bucket).push(classified);
  }
  return groups;
}

function bucketOrder(name) {
  // Numeric V buckets first, sorted descending by major. Named buckets next. Other last.
  if (name === 'Other') return [2, 0];
  const m = name.match(/V(\d+)$/);
  if (m && !/[a-z]/i.test(name.replace(/V\d+$/, ''))) {
    return [0, -parseInt(m[1], 10)];
  }
  return [1, name];
}

function compareBucket(a, b) {
  const ka = bucketOrder(a);
  const kb = bucketOrder(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (typeof ka[1] === 'number') return ka[1] - kb[1];
  return String(ka[1]).localeCompare(String(kb[1]));
}

function render(groups) {
  const lines = [];
  lines.push('# Changelog');
  lines.push('');
  lines.push(`_Auto-generated from git log on ${new Date().toISOString().slice(0, 10)}. Run \`node scripts/generate-changelog.js\` to refresh._`);
  lines.push('');

  const bucketNames = [...groups.keys()].sort(compareBucket);

  for (const name of bucketNames) {
    const entries = groups.get(name);
    // Within a bucket, sort by sortKey descending (newest minor first).
    entries.sort((a, b) => {
      for (let i = 0; i < a.sortKey.length; i++) {
        const av = a.sortKey[i];
        const bv = b.sortKey[i];
        if (av === bv) continue;
        if (typeof av === 'number' && typeof bv === 'number') return bv - av;
        return String(bv).localeCompare(String(av));
      }
      return 0;
    });

    lines.push(`## ${name}`);
    lines.push('');
    for (const e of entries) {
      const date = e.commit.date.slice(0, 10);
      const short = e.commit.hash.slice(0, 7);
      const label = e.label ? `**${e.label}**${e.prefix && !/^V/.test(e.prefix) ? ` _(${e.prefix})_` : e.prefix ? ` _(${e.prefix})_` : ''} — ` : '';
      lines.push(`- ${date} \`${short}\` ${label}${e.rest}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  let commits;
  try {
    commits = getCommits();
  } catch (err) {
    console.error('Failed to read git log:', err.message);
    process.exit(1);
  }

  if (commits.length === 0) {
    console.error('No commits found.');
    process.exit(1);
  }

  const groups = groupByBucket(commits);
  const output = render(groups);

  if (toStdout) {
    process.stdout.write(output);
    return;
  }

  const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  const outPath = path.join(repoRoot, 'CHANGELOG.md');
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Wrote ${outPath} (${commits.length} commits, ${groups.size} buckets)`);
}

main();
