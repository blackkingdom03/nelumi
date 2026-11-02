const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const id = process.env.SOURCE_RUN;
assert.match(id || '', /^\d+$/);
const repo = process.env.GITHUB_REPOSITORY;
assert.equal(repo, 'blackkingdom03/nelumi');
const api = endpoint => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${endpoint}`], { encoding: 'utf8' }));
const run = api(`actions/runs/${id}`);
assert.equal(run.path, '.github/workflows/desktop-build.yml');
assert.equal(run.head_repository.full_name, repo);
assert.match(run.head_sha, /^[a-f0-9]{40}$/);
const jobs = api(`actions/runs/${id}/jobs?per_page=100`).jobs;
for (const name of ['win-x64', 'win-arm64', 'mac-x64', 'mac-arm64', 'linux-x64']) {
  assert.ok(jobs.some(job => job.name === name && job.conclusion === 'success'), `Missing successful build: ${name}`);
}
// A corrected release manifest may reuse binaries, but application changes must rebuild.
const files = execFileSync('git', ['diff', '--name-only', run.head_sha, 'HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
for (const file of files) assert.ok(
  file === 'README.md' || file.startsWith('docs/') || file.startsWith('.github/workflows/') ||
  ['scripts/verify-release.cjs', 'scripts/verify-build-run.cjs'].includes(file),
  `Application changed since tested build: ${file}`
);
console.log(`All five build jobs passed for ${run.head_sha}; publication changes only: ${files.join(', ') || 'none'}`);
