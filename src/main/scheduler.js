const { REMINDER_TYPES, SNOOZE_MINUTES } = require('../shared/defaults');

const MINUTE = 60 * 1000;

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function isQuietAt(date, quietHours) {
  if (!quietHours.enabled) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return quietHours.periods.some((period) => {
    const start = timeToMinutes(period.start);
    const end = timeToMinutes(period.end);
    if (start === end) return true;
    return start < end ? now >= start && now < end : now >= start || now < end;
  });
}

class ReminderScheduler {
  constructor({ settings, now = () => Date.now(), onDue = () => {} }) {
    this.settings = settings;
    this.now = now;
    this.onDue = onDue;
    this.nextDue = {};
    this.snoozed = {};
    this.paused = false;
    this.systemInactive = false;
    this.wasQuiet = false;
    this.resetAll();
  }

  intervalMs(type) {
    return this.settings.reminders[type].intervalMinutes * MINUTE;
  }

  reset(type, at = this.now()) {
    this.snoozed[type] = false;
    this.nextDue[type] = this.settings.reminders[type].enabled ? at + this.intervalMs(type) : null;
  }

  resetAll(at = this.now()) {
    for (const type of REMINDER_TYPES) this.reset(type, at);
  }

  updateSettings(settings) {
    const previous = this.settings;
    const changedTypes = REMINDER_TYPES.filter((type) => {
      const before = previous.reminders[type];
      const after = settings.reminders[type];
      return before.enabled !== after.enabled || before.intervalMinutes !== after.intervalMinutes;
    });
    this.settings = settings;
    const timestamp = this.now();
    for (const type of changedTypes) this.reset(type, timestamp);
    return changedTypes;
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused) this.resetAll();
  }

  setSystemInactive(inactive) {
    if (this.systemInactive === inactive) return;
    this.systemInactive = inactive;
    if (!inactive) this.resetAll();
  }

  complete(type) {
    if (REMINDER_TYPES.includes(type)) this.reset(type);
  }

  snooze(type) {
    if (!REMINDER_TYPES.includes(type) || !this.settings.reminders[type].enabled) return;
    this.snoozed[type] = true;
    this.nextDue[type] = this.now() + SNOOZE_MINUTES * MINUTE;
  }

  tick() {
    const timestamp = this.now();
    const quiet = isQuietAt(new Date(timestamp), this.settings.quietHours);
    if (this.paused || this.systemInactive) return [];
    if (quiet) {
      this.wasQuiet = true;
      return [];
    }
    if (this.wasQuiet) {
      this.wasQuiet = false;
      this.resetAll(timestamp);
      return [];
    }

    const due = REMINDER_TYPES.filter((type) =>
      this.settings.reminders[type].enabled && this.nextDue[type] !== null && timestamp >= this.nextDue[type]
    );
    if (due.length) {
      for (const type of due) this.nextDue[type] = null;
      this.onDue(due);
    }
    return due;
  }

  snapshot() {
    return {
      nextDue: { ...this.nextDue },
      snoozed: { ...this.snoozed },
      paused: this.paused,
      systemInactive: this.systemInactive,
      quiet: isQuietAt(new Date(this.now()), this.settings.quietHours)
    };
  }
}

module.exports = { ReminderScheduler, isQuietAt, MINUTE };
