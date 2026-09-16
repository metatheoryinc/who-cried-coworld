// Run the actual renderer and event handlers without a browser or dependencies.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function setup(search = '') {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {id, dataset: {}, style: {}, value: '1', innerHTML: '', textContent: '', scrollTop: 0, scrollHeight: 100, clientHeight: 100,
      setAttribute(k, v) { this[k] = v; }, addEventListener(k, fn) { this[k] = fn; }, querySelectorAll() { return []; }, querySelector() { return null; }});
    return elements.get(id);
  };
  const handlers = {};
  const context = vm.createContext({ URLSearchParams, location: {search}, document: {
    body: element('body'), activeElement: null, getElementById: element,
    querySelector: element, querySelectorAll: () => [],
  }, requestAnimationFrame: () => {}, setTimeout: () => {}, setInterval: fn => { handlers.tick = fn; },
  addEventListener: (key, fn) => { handlers[key] = fn; } });
  for (const file of ['live-public.js', 'replay-export.js', 'notes.js']) vm.runInContext(fs.readFileSync(new URL('./fixtures/' + file, import.meta.url), 'utf8'), context);
  scripts.forEach(code => vm.runInContext(code, context));
  return {element, handlers, run: code => vm.runInContext(code, context)};
}
const tests = {
  'replay opens before spoilers': () => { const app = setup(); assert.equal(app.run('derive(shown()).finished'), false); assert.equal(app.run('derive(shown()).day'), 1); },
  'play at the end restarts': () => { const app = setup('?cursor=9999'); app.element('play').click(); assert.equal(app.run('state.playing'), true); assert.ok(app.run('state.cursor < maxCursor()')); },
  'playback reaches the end and can restart': () => { const app = setup(); app.element('play').click(); for (let i = 0; i < 100; i++) app.handlers.tick(); assert.equal(app.run('derive(shown()).finished'), true); assert.equal(app.run('state.playing'), false); app.element('play').click(); assert.equal(app.run('derive(shown()).finished'), false); },
  'next skips hidden events and pauses': () => { const app = setup('?cursor=2'); app.run('state.playing = true'); app.element('next').click(); assert.equal(app.run('state.playing'), false); assert.equal(app.run('data().events.find(e => e.cursor === state.cursor).reveal'), 'public'); },
  'space on a button preserves native activation': () => { const app = setup('?cursor=2'); app.handlers.keydown({key: ' ', target: {tagName: 'BUTTON', closest: () => ({})}, preventDefault() { throw new Error('button key was intercepted'); }}); assert.equal(app.run('state.playing'), false); },
  'invalid cursor falls back to beginning': () => { const app = setup('?cursor=oops'); assert.ok(app.run('Number.isFinite(state.cursor) && state.cursor >= 1')); },
  'live mode stays public': () => { const app = setup('?source=live&reveal=omniscient'); assert.equal(app.run('state.reveal'), 'aired'); assert.equal(app.run('shown().some(e => e.reveal !== "public")'), false); },
  'no deaths gives a complete dawn sentence': () => { const app = setup(); assert.match(app.run('knell([], "wolf", false)'), /No one|Everyone/); },
};
let failures = 0;
for (const [name, test] of Object.entries(tests)) {
  try { test(); console.log('ok   ' + name); }
  catch (e) { failures++; console.error('FAIL ' + name + ': ' + e.message); }
}
if (failures) process.exitCode = 1;
