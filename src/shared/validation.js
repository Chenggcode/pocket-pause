const { DEFAULT_SETTINGS, ICON_STYLES, MAX_QUIET_PERIODS, PET_STYLES, REMINDER_TYPES } = require('./defaults');

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function isTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeSettings(input = {}) {
  const result = cloneDefaults();
  for (const type of REMINDER_TYPES) {
    const source = input.reminders?.[type];
    if (source && typeof source.enabled === 'boolean') result.reminders[type].enabled = source.enabled;
    const minutes = Number(source?.intervalMinutes);
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 480) {
      result.reminders[type].intervalMinutes = minutes;
    }
  }

  if (typeof input.quietHours?.enabled === 'boolean') result.quietHours.enabled = input.quietHours.enabled;
  if (Array.isArray(input.quietHours?.periods)) {
    const periods = input.quietHours.periods
      .filter((period) => isTime(period?.start) && isTime(period?.end))
      .slice(0, MAX_QUIET_PERIODS)
      .map((period) => ({ start: period.start, end: period.end }));
    if (periods.length) result.quietHours.periods = periods;
  } else if (input.quietHours && ('start' in input.quietHours || 'end' in input.quietHours)) {
    const fallback = result.quietHours.periods[0];
    result.quietHours.periods = [{
      start: isTime(input.quietHours.start) ? input.quietHours.start : fallback.start,
      end: isTime(input.quietHours.end) ? input.quietHours.end : fallback.end
    }];
  }
  if (PET_STYLES.includes(input.appearance?.petStyle)) {
    result.appearance.petStyle = input.appearance.petStyle;
  }
  if (ICON_STYLES.includes(input.appearance?.iconStyle)) {
    result.appearance.iconStyle = input.appearance.iconStyle;
  }
  if (typeof input.launchAtLogin === 'boolean') result.launchAtLogin = input.launchAtLogin;
  if (Number.isInteger(input.petPosition?.x) && Number.isInteger(input.petPosition?.y)) {
    result.petPosition = { x: input.petPosition.x, y: input.petPosition.y };
  }
  return result;
}

module.exports = { normalizeSettings, isTime };
