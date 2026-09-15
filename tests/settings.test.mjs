import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync('src/scripts/bootstrap.js', 'utf8');
function bootstrap(value, denied = false) {
  const properties = {};
  const document = { documentElement: { dataset: {}, style: { setProperty: (key, value) => { properties[key] = value; } } } };
  const window = {};
  vm.runInNewContext(code, { window, document, localStorage: { getItem() { if (denied) throw new Error('denied'); return value; } } });
  return { result: JSON.parse(JSON.stringify(window.readerSettings)), document, properties };
}
test('defaults provide readable light theme without storage', () => {
  const { result, properties } = bootstrap(null);
  assert.deepEqual(result.value, { version: 1, theme: 'light', fontSize: 18 });
  assert.equal(properties['--reading-size'], '18px');
});
test('valid preferences survive a new page initialization', () => {
  const { result, document } = bootstrap('{"version":1,"theme":"dark","fontSize":23}');
  assert.equal(result.value.fontSize, 23); assert.equal(document.documentElement.dataset.theme, 'dark');
});
for (const [name, value, denied] of [
  ['malformed JSON', '{broken', false],
  ['unsupported config version', '{"version":2,"theme":"dark","fontSize":24}', false],
  ['invalid values', '{"version":1,"theme":"not-a-theme","fontSize":999}', false],
  ['denied browser storage', null, true],
]) test(`${name} cannot prevent reading`, () => {
  const { result } = bootstrap(value, denied);
  assert.deepEqual(result.value, { version: 1, theme: 'light', fontSize: 18 });
});
test('unrecognized compatible fields do not break existing settings', () => {
  assert.equal(bootstrap('{"version":1,"theme":"dark","fontSize":20,"futureField":true}').result.value.fontSize, 20);
});
