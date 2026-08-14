const fields = {
  petStyleOptions: document.querySelector('#pet-style-options'), iconStyleOptions: document.querySelector('#icon-style-options'),
  waterEnabled: document.querySelector('#water-enabled'), waterMinutes: document.querySelector('#water-minutes'),
  standEnabled: document.querySelector('#stand-enabled'), standMinutes: document.querySelector('#stand-minutes'),
  quietEnabled: document.querySelector('#quiet-enabled'), quietPeriods: document.querySelector('#quiet-periods'),
  quietPeriodTemplate: document.querySelector('#quiet-period-template'), addQuietPeriod: document.querySelector('#add-quiet-period'),
  launchAtLogin: document.querySelector('#launch-at-login')
};

const appearanceOptions = {
  petStyle: [
    { value: 'mint-cat', label: '薄荷猫' },
    { value: 'honey-bear', label: '蜂蜜熊' },
    { value: 'cloud-bunny', label: '云朵兔' }
  ],
  iconStyle: [
    { value: 'soft', label: '柔和' },
    { value: 'outline', label: '描边' },
    { value: 'pixel', label: '像素' }
  ]
};

const maxQuietPeriods = Number(fields.quietPeriods.dataset.maxPeriods);
let saveMessageTimer;

function showSaveMessage(text, error = false) {
  const message = document.querySelector('#save-message');
  clearTimeout(saveMessageTimer);
  message.textContent = text;
  message.classList.toggle('error', error);
  if (!error) saveMessageTimer = setTimeout(() => { message.textContent = ''; }, 2200);
}

function createAppearanceOption(group, option) {
  const label = document.createElement('label');
  label.className = 'appearance-choice';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = group === 'petStyle' ? 'pet-style' : 'icon-style';
  input.value = option.value;
  const content = document.createElement('span');
  content.className = 'appearance-choice-content';
  const preview = document.createElement('span');
  preview.className = group === 'petStyle' ? `pet-option-preview ${option.value}` : `icon-option-preview ${option.value}`;
  preview.setAttribute('aria-hidden', 'true');
  if (group === 'petStyle') {
    preview.append(document.createElement('i'));
  } else {
    const water = document.createElement('i'); water.textContent = '●';
    const stand = document.createElement('i'); stand.textContent = '↑';
    preview.append(water, stand);
  }
  const text = document.createElement('strong');
  text.textContent = option.label;
  content.append(preview, text);
  label.append(input, content);
  return label;
}

function buildAppearanceOptions() {
  for (const option of appearanceOptions.petStyle) {
    fields.petStyleOptions.append(createAppearanceOption('petStyle', option));
  }
  for (const option of appearanceOptions.iconStyle) {
    fields.iconStyleOptions.append(createAppearanceOption('iconStyle', option));
  }
}

function syncQuietPeriodControls() {
  const rows = [...fields.quietPeriods.querySelectorAll('.time-row')];
  fields.addQuietPeriod.disabled = rows.length >= maxQuietPeriods;
  for (const row of rows) {
    const remove = row.querySelector('.remove-time');
    remove.disabled = rows.length === 1;
    remove.title = remove.disabled ? '至少保留一个时段' : '删除时段';
  }
}

function appendQuietPeriod(period) {
  if (fields.quietPeriods.children.length >= maxQuietPeriods) return;
  const fragment = fields.quietPeriodTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.time-row');
  row.querySelector('.quiet-start').value = period.start;
  row.querySelector('.quiet-end').value = period.end;
  row.querySelector('.remove-time').addEventListener('click', () => {
    row.remove();
    syncQuietPeriodControls();
  });
  fields.quietPeriods.append(fragment);
  syncQuietPeriodControls();
}

function renderQuietPeriods(periods) {
  fields.quietPeriods.replaceChildren();
  for (const period of periods) appendQuietPeriod(period);
}

function render(settings) {
  document.querySelector(`input[name="pet-style"][value="${settings.appearance.petStyle}"]`).checked = true;
  document.querySelector(`input[name="icon-style"][value="${settings.appearance.iconStyle}"]`).checked = true;
  document.documentElement.dataset.iconStyle = settings.appearance.iconStyle;
  fields.waterEnabled.checked = settings.reminders.water.enabled;
  fields.waterMinutes.value = settings.reminders.water.intervalMinutes;
  fields.standEnabled.checked = settings.reminders.stand.enabled;
  fields.standMinutes.value = settings.reminders.stand.intervalMinutes;
  fields.quietEnabled.checked = settings.quietHours.enabled;
  renderQuietPeriods(settings.quietHours.periods);
  fields.launchAtLogin.checked = settings.launchAtLogin;
}

function updateStatus(status) {
  const element = document.querySelector('#status');
  const quiet = status.quiet;
  const paused = status.paused || status.systemInactive || quiet;
  element.classList.toggle('paused', paused);
  element.querySelector('strong').textContent = quiet ? '当前免打扰' : status.systemInactive ? '离开时已暂停' : status.paused ? '提醒已暂停' : '提醒运行中';
}

document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter || document.querySelector('.save-button');
  button.disabled = true;
  showSaveMessage('正在保存');
  const input = {
    appearance: {
      petStyle: document.querySelector('input[name="pet-style"]:checked')?.value || 'mint-cat',
      iconStyle: document.querySelector('input[name="icon-style"]:checked')?.value || 'soft'
    },
    reminders: {
      water: { enabled: fields.waterEnabled.checked, intervalMinutes: Number(fields.waterMinutes.value) },
      stand: { enabled: fields.standEnabled.checked, intervalMinutes: Number(fields.standMinutes.value) }
    },
    quietHours: {
      enabled: fields.quietEnabled.checked,
      periods: [...fields.quietPeriods.querySelectorAll('.time-row')].map((row) => ({
        start: row.querySelector('.quiet-start').value,
        end: row.querySelector('.quiet-end').value
      }))
    },
    launchAtLogin: fields.launchAtLogin.checked
  };
  try {
    const result = await window.pauseApi.saveSettings(input);
    render(result.settings); updateStatus(result.status);
    showSaveMessage('设置已保存');
  } catch {
    showSaveMessage('保存失败，请重试', true);
  } finally {
    button.disabled = false;
  }
});

fields.addQuietPeriod.addEventListener('click', () => {
  appendQuietPeriod({ start: '12:00', end: '13:00' });
  fields.quietPeriods.lastElementChild.querySelector('.quiet-start').focus();
});

fields.iconStyleOptions.addEventListener('change', (event) => {
  if (event.target.name === 'icon-style') document.documentElement.dataset.iconStyle = event.target.value;
});

buildAppearanceOptions();
window.pauseApi.onSettingsChanged(render);
window.pauseApi.onStatusChanged(updateStatus);
window.pauseApi.getSettings().then(({ settings, status }) => { render(settings); updateStatus(status); });
