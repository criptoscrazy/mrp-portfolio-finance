// Offline regression: execute the exact workflow shell, with curl replaced by a mock.
// No Supabase connection, credentials, financial data, or browser storage is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/supabase-keepalive.yml'), 'utf8');
const shell = workflow.split('        run: |\n')[1].split('\n      - name:')[0]
  .split('\n').map(line => line.replace(/^          /, '')).join('\n');
assert.deepEqual([...workflow.matchAll(/cron: "([^"]+)"/g)].map(match => match[1]),
  ['17 6 * * *', '43 14 * * *', '29 22 * * *']);
assert.match(workflow, /permissions:\n  contents: read/);
assert.match(workflow, /if: failure\(\)/);
assert.doesNotMatch(shell, /portfolio_data|\/rest\/v1\/[^r]|security definer/);
assert.equal(spawnSync('bash', ['-n'], { input: shell }).status, 0, 'Shell syntax');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mrp-keepalive-test-'));
const jwt = role => ['eyJ0eXAiOiJKV1QifQ', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'synthetic'].join('.');
const anon = jwt('anon');
const valid = () => JSON.stringify({ ok: true, checked_at: new Date().toISOString() });
let passed = 0;

try {
  fs.writeFileSync(path.join(tmp, 'curl'), `#!${process.execPath}\n
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
assert.equal(args.at(-1), 'https://dddojedzyrcjqasyomso.supabase.co/rest/v1/rpc/keepalive');
for (const flag of ['--fail', '--retry-connrefused', '--connect-timeout', '--max-time', '--retry-max-time']) assert(args.includes(flag));
assert.equal(args[args.indexOf('--request') + 1], 'POST');
assert.equal(args[args.indexOf('--retry') + 1], '2');
assert.equal(args[args.indexOf('--data') + 1], '{}');
assert(args.includes('apikey: ' + process.env.SUPABASE_ANON_KEY));
assert.equal(args.some(arg => arg.startsWith('Authorization:')), !process.env.SUPABASE_ANON_KEY.startsWith('sb_publishable_'));
if (process.env.MOCK_HTTP_FAILURE === '1') process.exit(22);
process.stdout.write(process.env.MOCK_RESPONSE);
`, { mode: 0o700 });

  function check(name, changes, success) {
    const summary = path.join(tmp, 'summary');
    fs.writeFileSync(summary, '');
    const result = spawnSync('bash', ['-c', shell], {
      env: { ...process.env, PATH: `${tmp}:${process.env.PATH}`,
        SUPABASE_URL: 'https://dddojedzyrcjqasyomso.supabase.co',
        SUPABASE_ANON_KEY: anon, MOCK_RESPONSE: valid(),
        MOCK_HTTP_FAILURE: '0', GITHUB_STEP_SUMMARY: summary, ...changes },
      encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.status === 0, success, `${name}: ${result.stderr}`);
    const output = result.stdout + result.stderr + fs.readFileSync(summary, 'utf8');
    assert(!output.includes(anon), `${name}: leaked synthetic credential`);
    if (changes.SUPABASE_ANON_KEY) assert(!output.includes(changes.SUPABASE_ANON_KEY), `${name}: leaked key`);
    assert.equal(output.includes('completed successfully'), success, name);
    if (success) assert.match(output, /Database confirmation \(UTC\):/);
    else assert.equal(fs.readFileSync(summary, 'utf8'), '', `${name}: false success summary`);
    console.log(`PASS ${name}`);
    passed++;
  }

  check('anon JWT, fresh UTC confirmation', {}, true);
  check('publishable key without Bearer', { SUPABASE_ANON_KEY: 'sb_publishable_synthetic' }, true);
  check('trailing slash URL', { SUPABASE_URL: 'https://dddojedzyrcjqasyomso.supabase.co/' }, true);
  check('PostgreSQL microseconds and UTC offset', { MOCK_RESPONSE: JSON.stringify({ ok: true,
    checked_at: new Date().toISOString().replace('Z', '123+00:00') }) }, true);
  check('no Actions summary outside CI', { GITHUB_STEP_SUMMARY: '' }, true);
  check('missing URL', { SUPABASE_URL: '' }, false);
  check('missing key', { SUPABASE_ANON_KEY: '' }, false);
  check('wrong project', { SUPABASE_URL: 'https://another.supabase.co' }, false);
  check('insecure URL', { SUPABASE_URL: 'http://dddojedzyrcjqasyomso.supabase.co' }, false);
  check('service_role rejected', { SUPABASE_ANON_KEY: jwt('service_role') }, false);
  check('secret key rejected', { SUPABASE_ANON_KEY: 'sb_secret_synthetic' }, false);
  check('malformed key rejected', { SUPABASE_ANON_KEY: 'not-a-key' }, false);
  check('HTTP failure / paused project', { MOCK_HTTP_FAILURE: '1' }, false);
  check('ok false', { MOCK_RESPONSE: JSON.stringify({ ok: false, checked_at: new Date().toISOString() }) }, false);
  check('HTTP 200 without database timestamp', { MOCK_RESPONSE: '{"ok":true}' }, false);
  check('stale timestamp', { MOCK_RESPONSE: JSON.stringify({ ok: true, checked_at: new Date(Date.now() - 600000).toISOString() }) }, false);
  check('future timestamp', { MOCK_RESPONSE: JSON.stringify({ ok: true, checked_at: new Date(Date.now() + 120000).toISOString() }) }, false);
  check('invalid timestamp', { MOCK_RESPONSE: '{"ok":true,"checked_at":"invalid"}' }, false);
  check('non-UTC timestamp', { MOCK_RESPONSE: '{"ok":true,"checked_at":"2026-10-03T14:00:00+02:00"}' }, false);
  check('empty response', { MOCK_RESPONSE: '' }, false);
  check('invalid JSON', { MOCK_RESPONSE: '<html>Unavailable</html>' }, false);
  check('null response', { MOCK_RESPONSE: 'null' }, false);
  check('array response', { MOCK_RESPONSE: '[{"ok":true}]' }, false);
  console.log(`${passed} keepalive regression checks passed (offline).`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
