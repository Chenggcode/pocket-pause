const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JsonStore } = require('../src/main/store');
const { normalizeSettings } = require('../src/shared/validation');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-pause-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('loads defaults when the settings file is missing or invalid', (t) => {
  const directory = temporaryDirectory(t);
  const store = new JsonStore(directory);
  assert.deepEqual(store.load(), normalizeSettings());

  fs.writeFileSync(store.file, '{ invalid json', 'utf8');
  assert.deepEqual(store.load(), normalizeSettings());
});

test('saves settings atomically and reloads the normalized value', (t) => {
  const directory = temporaryDirectory(t);
  const store = new JsonStore(directory);
  const settings = normalizeSettings({
    reminders: { water: { enabled: true, intervalMinutes: 35 } },
    appearance: { petStyle: 'cloud-bunny', iconStyle: 'pixel' },
    quietHours: { periods: [{ start: '12:00', end: '13:00' }] },
    petPosition: { x: 120, y: 240 }
  });

  store.save(settings);

  assert.deepEqual(new JsonStore(directory).load(), settings);
  assert.equal(fs.existsSync(`${store.file}.tmp`), false);
});

test('keeps the previous settings and removes the temporary file when replacement fails', (t) => {
  const directory = temporaryDirectory(t);
  const store = new JsonStore(directory);
  const previous = normalizeSettings({ reminders: { water: { intervalMinutes: 30 } } });
  store.save(previous);

  const failingFileSystem = {
    ...fs,
    renameSync() {
      throw new Error('replacement failed');
    }
  };
  const failingStore = new JsonStore(directory, failingFileSystem);

  assert.throws(() => failingStore.save(normalizeSettings({ reminders: { water: { intervalMinutes: 90 } } })), /replacement failed/);
  assert.deepEqual(store.load(), previous);
  assert.equal(fs.existsSync(`${store.file}.tmp`), false);
});
