// Cross-platform syntax check: runs `node --check` on every JS file.
// Mirrors the CI workflow steps so `npm run check` works on Windows + POSIX.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dirs = ['routes', 'socket', 'lib', 'public', 'scripts'];
const files = ['server.js'];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.js')) files.push(path.join(dir, name));
  }
}

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('OK   ' + file);
  } catch (err) {
    failed++;
    console.error('FAIL ' + file);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed syntax check`);
  process.exit(1);
}
console.log(`\nAll ${files.length} files passed syntax check`);
