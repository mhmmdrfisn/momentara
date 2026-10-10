// Headless-Chrome e2e driver for Momentara, using raw CDP over Node's built-in
// WebSocket (no npm dependencies).
//
//   node tools/e2e-run.js            → run every suite
//   node tools/e2e-run.js e2e        → run one suite
//
// Exit code is non-zero when any assertion fails, so CI can gate on it.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8123;
const CDP_PORT = 9333;
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Chrome/Edge binary found. Set CHROME_PATH.');
  return found;
}

// ── tiny CDP client ─────────────────────────────────────────────────────────
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null;
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (this.sessionId) payload.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(method + ' timed out')); }
      }, 60000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
      (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
}

// ── suites ──────────────────────────────────────────────────────────────────
const SUITES = [
  {
    name: 'e2e',
    url: `http://localhost:${PORT}/tools/e2e.html`,
    readyWhen: 'document.title === "done"',
    timeout: 60000,
    extract: `JSON.stringify({ log: document.getElementById('log').innerText })`
  }
];

async function main() {
  const only = process.argv[2];
  const suites = only ? SUITES.filter(s => s.name === only) : SUITES;
  if (!suites.length) throw new Error('no such suite: ' + only);

  const chromePath = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'momentara-e2e-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--disable-extensions', '--mute-audio',
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--window-size=1280,1000',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + CDP_PORT,
    'about:blank'
  ], { stdio: 'ignore' });

  let failed = 0;
  try {
    // wait for the debugging endpoint
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
        target = list.find(t => t.type === 'page');
      } catch { /* not up yet */ }
    }
    if (!target) throw new Error('Chrome DevTools endpoint never came up');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const suite of suites) {
      console.log('\n══ ' + suite.name + ' ══════════════════════════════════════');
      const logs = [];
      ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
          logs.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
        }
        if (m.method === 'Runtime.exceptionThrown') {
          logs.push('uncaught: ' + (m.params.exceptionDetails.exception?.description ||
            m.params.exceptionDetails.text));
        }
      });

      await cdp.send('Page.navigate', { url: suite.url });

      const deadline = Date.now() + suite.timeout;
      let ready = false;
      while (Date.now() < deadline) {
        await sleep(400);
        try { if (await cdp.eval(suite.readyWhen)) { ready = true; break; } } catch { }
      }

      const report = await cdp.eval(suite.extract);
      console.log(JSON.parse(report).log);

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const shotPath = path.join(os.tmpdir(), 'opencode', suite.name + '-result.png');
      fs.mkdirSync(path.dirname(shotPath), { recursive: true });
      fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));

      const text = JSON.parse(report).log;
      const bad = (text.match(/FAIL/g) || []).length;
      const errs = logs.length;
      if (!ready) { console.log('  ✗ suite never finished (timeout)'); failed++; }
      if (bad) { console.log(`  ✗ ${bad} failed assertion(s)`); failed++; }
      if (errs) { console.log(`  ✗ ${errs} console error(s)`); logs.forEach(l => console.log('     ' + l)); failed++; }
      if (ready && !bad && !errs) console.log('  ✓ ' + suite.name + ' passed · screenshot → ' + shotPath);
      logs.length = 0;
    }
    ws.close();
  } finally {
    chrome.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { }
  }

  console.log(failed ? `\n${failed} suite(s) failed.` : '\nAll suites passed.');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('driver error:', e); process.exit(1); });