const root = document.querySelector('#pet');
const bubble = document.querySelector('#bubble');
const character = document.querySelector('.character');
const labels = { water: '该喝水了', stand: '起来活动一下' };
const petLabels = { 'mint-cat': '薄荷猫', 'honey-bear': '蜂蜜熊', 'cloud-bunny': '云朵兔' };

function render({ state, reminders = [], appearance = {} }) {
  const petStyle = petLabels[appearance.petStyle] ? appearance.petStyle : 'mint-cat';
  const iconStyle = ['soft', 'outline', 'pixel'].includes(appearance.iconStyle) ? appearance.iconStyle : 'soft';
  root.className = `pet ${state}`;
  root.dataset.petStyle = petStyle;
  root.dataset.iconStyle = iconStyle;
  character.setAttribute('aria-label', petLabels[petStyle]);
  if (state !== 'reminder') { bubble.replaceChildren(); return; }
  const title = document.createElement('p');
  title.className = 'bubble-title';
  title.textContent = reminders.length > 1 ? '给自己一个短暂停顿' : labels[reminders[0]];
  bubble.replaceChildren(title);
  for (const type of reminders) {
    const row = document.createElement('div'); row.className = 'reminder-item';
    const symbol = document.createElement('span'); symbol.className = `reminder-symbol ${type}`; symbol.setAttribute('aria-hidden', 'true'); symbol.textContent = type === 'water' ? '●' : '↑';
    const label = document.createElement('span'); label.className = 'reminder-label'; label.textContent = labels[type];
    const snooze = document.createElement('button'); snooze.className = 'action'; snooze.textContent = '10 分钟后';
    const done = document.createElement('button'); done.className = 'action primary'; done.textContent = '完成';
    snooze.addEventListener('click', () => window.petApi.act(type, 'snooze'));
    done.addEventListener('click', () => window.petApi.act(type, 'complete'));
    row.append(symbol, label, snooze, done); bubble.append(row);
  }
}

document.querySelector('#hide').addEventListener('click', window.petApi.hide);
window.petApi.onState(render);
