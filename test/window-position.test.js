const test = require('node:test');
const assert = require('node:assert/strict');
const { fitWindowToBounds } = require('../src/main/window-position');

const size = { width: 360, height: 260 };

test('moves an overflowing pet window fully inside the work area', () => {
  const position = fitWindowToBounds(
    { x: 620, y: 500 },
    { x: 0, y: 0, width: 900, height: 700 },
    size
  );
  assert.deepEqual(position, { x: 532, y: 432 });
});

test('preserves visible positions on displays with negative coordinates', () => {
  const position = fitWindowToBounds(
    { x: -1200, y: 120 },
    { x: -1440, y: 0, width: 1440, height: 900 },
    size
  );
  assert.deepEqual(position, { x: -1200, y: 120 });
});

test('clamps positions against every edge of the work area', () => {
  const position = fitWindowToBounds(
    { x: -100, y: -200 },
    { x: 0, y: 0, width: 900, height: 700 },
    size
  );
  assert.deepEqual(position, { x: 8, y: 8 });
});
