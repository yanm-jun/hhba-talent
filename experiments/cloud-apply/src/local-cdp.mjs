import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
export async function openBrowser() {
  const tmp = await mkdtemp(join(tmpdir(), 'hhba-cdp-'));
  const port = await freePort();
  const binary = process.env.CHROMIUM_PATH || 'chromium';
  const child = spawn(binary, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1', '--remote-allow-origins=*',
    '--remote-debugging-port=' + port, '--user-data-dir=' + tmp, 'about:blank'
  ], { stdio: 'ignore' });
  let wsUrl;
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (child.exitCode !== null) throw new Error('Chromium exited early');
      try {
        const data = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
        wsUrl = data.find(x => x.type === 'page' && x.url === 'about:blank')?.webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch { /* Browser is not ready. */ }
      await delay(100);
    }
    if (!wsUrl) throw new Error('CDP target not ready');
    const client = await connectCDP(wsUrl);
    return {
      client,
      async close() {
        client.close();
        child.kill('SIGTERM');
        await delay(100);
        await rm(tmp, { force: true, recursive: true });
      }
    };
  } catch (error) {
    child.kill('SIGTERM');
    await rm(tmp, { force: true, recursive: true });
    throw error;
  }
}
export async function connectCDP(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (!m.id || !pending.has(m.id)) return;
    const { resolve, reject, timer } = pending.get(m.id);
    clearTimeout(timer);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  });
  socket.addEventListener('close', () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error('CDP closed'));
    }
    pending.clear();
  });
  async function command(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }, 8000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  const page = {
    async gotoFixture(html) {
      if (typeof html !== 'string' || !html.includes('HHBA 测试招聘网申')) {
        throw new Error('Refusing non-fixture content');
      }
      // Populate about:blank without external navigation, account data or network requests.
      const expression = 'document.open();document.write(' + JSON.stringify(html) + ');document.close();';
      const r = await command('Runtime.evaluate', { expression, returnByValue: true });
      if (r.exceptionDetails) throw new Error('Fixture injection rejected');
      for (let n = 0; n < 50; n++) {
        const state = await command('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (state.result?.value === 'complete') return;
        await delay(100);
      }
      throw new Error('Fixture load timeout');
    },
    async evaluate(fn, arg) {
      const script = '(' + fn.toString() + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')';
      const r = await command('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'Runtime exception');
      return r.result.value;
    }
  };
  return { page, close() { socket.close(); } };
}
