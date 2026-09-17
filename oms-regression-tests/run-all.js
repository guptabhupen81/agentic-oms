// Runs every *.test.js file in this folder as a separate process, streams
// its output, and gives one combined pass/fail summary at the end. Exits
// non-zero if any suite failed — safe to wire into a CI step later if this
// project ever gets one.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFiles = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

if (testFiles.length === 0) {
  console.log('No *.test.js files found.');
  process.exit(1);
}

let anyFailed = false;

for (const file of testFiles) {
  console.log(`\n=== ${file} ===`);
  try {
    const output = execFileSync('node', [path.join(__dirname, file)], { encoding: 'utf8' });
    console.log(output.trim());
  } catch (err) {
    anyFailed = true;
    console.log(err.stdout ? err.stdout.trim() : '(no output)');
    console.log(`\n>>> ${file} exited with a failure.`);
  }
}

console.log('\n' + '='.repeat(50));
console.log(anyFailed ? 'RESULT: one or more suites FAILED — see above.' : 'RESULT: all suites passed.');
process.exit(anyFailed ? 1 : 0);
