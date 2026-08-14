const DEFAULT_SETTINGS = Object.freeze({
  reminders: {
    water: { enabled: true, intervalMinutes: 45 },
    stand: { enabled: true, intervalMinutes: 60 }
  },
  quietHours: { enabled: true, periods: [{ start: '22:00', end: '08:00' }] },
  appearance: { petStyle: 'mint-cat', iconStyle: 'soft' },
  launchAtLogin: false
});

const REMINDER_TYPES = Object.freeze(['water', 'stand']);
const PET_STYLES = Object.freeze(['mint-cat', 'honey-bear', 'cloud-bunny']);
const ICON_STYLES = Object.freeze(['soft', 'outline', 'pixel']);
const SNOOZE_MINUTES = 10;
const IDLE_THRESHOLD_SECONDS = 5 * 60;
const MAX_QUIET_PERIODS = 8;

module.exports = {
  DEFAULT_SETTINGS,
  REMINDER_TYPES,
  PET_STYLES,
  ICON_STYLES,
  SNOOZE_MINUTES,
  IDLE_THRESHOLD_SECONDS,
  MAX_QUIET_PERIODS
};
