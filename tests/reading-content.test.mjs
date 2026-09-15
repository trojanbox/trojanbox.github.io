import test from 'node:test';
import assert from 'node:assert/strict';
import { readingContent } from '../scripts/reading-content.mjs';
const treeFor = src => ({ type: 'root', children: [{ type: 'element', tagName: 'p', properties: {}, children: [{ type: 'element', tagName: 'img', properties: { src, alt: 'image', title: 'Caption' }, children: [] }] }] });
test('local lazy images reserve their intrinsic geometry at build time', async () => {
  const tree = treeFor('/media/reading-mark.svg');
  await readingContent()(tree);
  assert.equal(tree.children[0].tagName, 'figure');
  const image = tree.children[0].children[0];
  assert.equal(image.properties.width, 192);
  assert.equal(image.properties.height, 192);
  assert.equal(image.properties.loading, 'lazy');
  assert.equal(tree.children[0].children[1].children[0].value, 'Caption');
});
test('external images are not downloaded during content compilation', async () => {
  const tree = treeFor('https://example.com/photo.png');
  await readingContent()(tree);
  assert.equal(tree.children[0].children[0].properties.width, undefined);
});
test('local image resolution cannot escape the public asset directory', async () => {
  await assert.rejects(readingContent()(treeFor('/../package.json')), /escapes public/);
});
