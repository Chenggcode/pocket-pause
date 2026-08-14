const test = require('node:test');
const assert = require('node:assert/strict');
const { ReminderScheduler, isQuietAt, MINUTE } = require('../src/main/scheduler');
const { normalizeSettings } = require('../src/shared/validation');

function setup(overrides = {}) {
  let now = new Date(2026, 7, 13, 12, 0).getTime();
  const due = [];
  const settings = normalizeSettings(overrides);
  const scheduler = new ReminderScheduler({ settings, now: () => now, onDue: (types) => due.push(types) });
  return { scheduler, due, advance: (minutes) => { now += minutes * MINUTE; }, setNow: (value) => { now = value; } };
}

test('uses independent reminder intervals', () => {
  const context = setup({ reminders: { water: { enabled: true, intervalMinutes: 45 }, stand: { enabled: true, intervalMinutes: 60 } }, quietHours: { enabled: false } });
  context.advance(45); assert.deepEqual(context.scheduler.tick(), ['water']);
  context.advance(15); assert.deepEqual(context.scheduler.tick(), ['stand']);
});

test('merges reminders due on the same tick', () => {
  const context = setup({ reminders: { water: { enabled: true, intervalMinutes: 30 }, stand: { enabled: true, intervalMinutes: 30 } }, quietHours: { enabled: false } });
  context.advance(30); assert.deepEqual(context.scheduler.tick(), ['water', 'stand']);
  assert.deepEqual(context.due, [['water', 'stand']]);
});

test('complete resets and snooze schedules ten minutes', () => {
  const context = setup({ reminders: { water: { enabled: true, intervalMinutes: 20 }, stand: { enabled: false } }, quietHours: { enabled: false } });
  context.advance(20); context.scheduler.tick(); context.scheduler.snooze('water');
  context.advance(9); assert.deepEqual(context.scheduler.tick(), []);
  context.advance(1); assert.deepEqual(context.scheduler.tick(), ['water']);
  context.scheduler.complete('water'); context.advance(20); assert.deepEqual(context.scheduler.tick(), ['water']);
});

test('settings updates only reset reminders whose schedule changed', () => {
  const context = setup({ reminders: { water: { enabled: true, intervalMinutes: 45 }, stand: { enabled: true, intervalMinutes: 60 } }, quietHours: { enabled: false } });
  context.advance(20);
  const before = context.scheduler.snapshot().nextDue;
  context.scheduler.updateSettings(normalizeSettings({ reminders: { water: { enabled: true, intervalMinutes: 30 }, stand: { enabled: true, intervalMinutes: 60 } }, quietHours: { enabled: false } }));
  const after = context.scheduler.snapshot().nextDue;
  assert.equal(after.water, before.water + 5 * MINUTE);
  assert.equal(after.stand, before.stand);
  context.advance(29); assert.deepEqual(context.scheduler.tick(), []);
  context.advance(1); assert.deepEqual(context.scheduler.tick(), ['water']);
  context.advance(10); assert.deepEqual(context.scheduler.tick(), ['stand']);
});

test('unrelated settings changes preserve active snoozes', () => {
  const context = setup({ reminders: { water: { enabled: true, intervalMinutes: 20 }, stand: { enabled: false } }, quietHours: { enabled: false } });
  context.advance(20); context.scheduler.tick(); context.scheduler.snooze('water'); context.advance(3);
  const before = context.scheduler.snapshot().nextDue.water;
  context.scheduler.updateSettings(normalizeSettings({ reminders: { water: { enabled: true, intervalMinutes: 20 }, stand: { enabled: false } }, quietHours: { enabled: true, periods: [{ start: '23:00', end: '07:00' }] }, appearance: { petStyle: 'honey-bear', iconStyle: 'outline' }, launchAtLogin: true }));
  assert.equal(context.scheduler.snapshot().nextDue.water, before);
  context.advance(7); assert.deepEqual(context.scheduler.tick(), ['water']);
});

test('multiple quiet periods work during the day and across midnight', () => {
  const quiet = {
    enabled: true,
    periods: [
      { start: '12:00', end: '13:00' },
      { start: '22:00', end: '08:00' }
    ]
  };
  assert.equal(isQuietAt(new Date(2026, 7, 13, 12, 30), quiet), true);
  assert.equal(isQuietAt(new Date(2026, 7, 13, 13, 0), quiet), false);
  assert.equal(isQuietAt(new Date(2026, 7, 13, 23, 0), quiet), true);
  assert.equal(isQuietAt(new Date(2026, 7, 14, 7, 59), quiet), true);
  assert.equal(isQuietAt(new Date(2026, 7, 14, 8, 0), quiet), false);
  assert.equal(isQuietAt(new Date(2026, 7, 14, 10, 0), quiet), false);
});

test('leaving quiet hours and returning from inactivity restart full intervals', () => {
  const context = setup({ reminders: { water: { enabled: true, intervalMinutes: 20 }, stand: { enabled: false } } });
  context.setNow(new Date(2026, 7, 13, 22, 1).getTime()); context.scheduler.tick();
  context.setNow(new Date(2026, 7, 14, 8, 0).getTime()); assert.deepEqual(context.scheduler.tick(), []);
  context.advance(19); assert.deepEqual(context.scheduler.tick(), []);
  context.advance(1); assert.deepEqual(context.scheduler.tick(), ['water']);
  context.scheduler.setSystemInactive(true); context.advance(50); assert.deepEqual(context.scheduler.tick(), []);
  context.scheduler.setSystemInactive(false); context.advance(19); assert.deepEqual(context.scheduler.tick(), []);
  context.advance(1); assert.deepEqual(context.scheduler.tick(), ['water']);
});

test('normalizes invalid persisted settings', () => {
  const settings = normalizeSettings({ reminders: { water: { enabled: false, intervalMinutes: 0 } }, quietHours: { start: '99:00' }, appearance: { petStyle: 'dragon', iconStyle: 'neon' }, petPosition: { x: 42, y: 84 } });
  assert.equal(settings.reminders.water.enabled, false);
  assert.equal(settings.reminders.water.intervalMinutes, 45);
  assert.deepEqual(settings.quietHours.periods, [{ start: '22:00', end: '08:00' }]);
  assert.deepEqual(settings.appearance, { petStyle: 'mint-cat', iconStyle: 'soft' });
  assert.deepEqual(settings.petPosition, { x: 42, y: 84 });
});

test('normalizes supported appearance styles', () => {
  const settings = normalizeSettings({ appearance: { petStyle: 'cloud-bunny', iconStyle: 'pixel' } });
  assert.deepEqual(settings.appearance, { petStyle: 'cloud-bunny', iconStyle: 'pixel' });
});

test('migrates legacy quiet hours and discards invalid periods', () => {
  const migrated = normalizeSettings({ quietHours: { enabled: true, start: '23:00', end: '07:00' } });
  assert.deepEqual(migrated.quietHours.periods, [{ start: '23:00', end: '07:00' }]);

  const normalized = normalizeSettings({
    quietHours: {
      periods: [
        { start: '09:00', end: '10:00' },
        { start: '25:00', end: '11:00' },
        { start: '12:00', end: '13:00' }
      ]
    }
  });
  assert.deepEqual(normalized.quietHours.periods, [
    { start: '09:00', end: '10:00' },
    { start: '12:00', end: '13:00' }
  ]);

  const limited = normalizeSettings({
    quietHours: {
      periods: Array.from({ length: 9 }, (_, hour) => ({
        start: `${String(hour).padStart(2, '0')}:00`,
        end: `${String(hour).padStart(2, '0')}:30`
      }))
    }
  });
  assert.equal(limited.quietHours.periods.length, 8);
});
