const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } = require('electron');
const { ReminderScheduler } = require('./scheduler');
const { JsonStore } = require('./store');
const { fitWindowToBounds } = require('./window-position');
const { normalizeSettings } = require('../shared/validation');
const { IDLE_THRESHOLD_SECONDS, REMINDER_TYPES } = require('../shared/defaults');

const ASSETS_DIR = path.join(__dirname, '../../assets');
const PET_WINDOW_SIZE = Object.freeze({ width: 360, height: 260 });
const ICON_ASSET_NAMES = Object.freeze({ soft: 'tray-soft', outline: 'tray-outline', pixel: 'tray-pixel' });
const HIDDEN_LOGIN_ARG = '--hidden';

let settingsWindow;
let petWindow;
let tray;
let store;
let settings;
let scheduler;
let timer;
let quitting = false;
let pendingReminders = [];
let manuallyPaused = false;
let powerInactive = false;
let idleInactive = false;

function loginItemArguments() {
  return app.isPackaged ? [HIDDEN_LOGIN_ARG] : [app.getAppPath(), HIDDEN_LOGIN_ARG];
}

function readLoginItemSettings() {
  return process.platform === 'win32'
    ? app.getLoginItemSettings({ args: loginItemArguments() })
    : app.getLoginItemSettings();
}

function configureLaunchAtLogin(enabled) {
  const options = { openAtLogin: enabled };
  if (process.platform === 'win32') options.args = loginItemArguments();
  app.setLoginItemSettings(options);
}

function isLaunchAtLoginEnabled(loginItem) {
  return process.platform === 'win32'
    ? loginItem.openAtLogin || loginItem.executableWillLaunchAtLogin
    : loginItem.openAtLogin;
}

function wasStartedAtLogin(loginItem) {
  if (process.platform === 'win32') return process.argv.includes(HIDDEN_LOGIN_ARG);
  return process.platform === 'darwin' && loginItem.wasOpenedAtLogin;
}

function iconAssetPath(iconStyle, template = false) {
  const baseName = ICON_ASSET_NAMES[iconStyle] || ICON_ASSET_NAMES.soft;
  return path.join(ASSETS_DIR, `${baseName}${template ? 'Template' : ''}.png`);
}

function createAppIcon(iconStyle) {
  const iconPath = iconAssetPath(iconStyle);
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) throw new Error(`Unable to load app icon: ${iconPath}`);
  return icon;
}

function createTrayIcon(iconStyle) {
  const iconPath = iconAssetPath(iconStyle, process.platform === 'darwin');
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) throw new Error(`Unable to load tray icon: ${iconPath}`);
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
    return icon;
  }
  return icon.resize({ width: 20, height: 20 });
}

function secureWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function assertIpcSender(event, expectedWindow) {
  if (!expectedWindow || expectedWindow.isDestroyed() || event.sender !== expectedWindow.webContents) {
    throw new Error('Unexpected IPC sender');
  }
}

function createSettingsWindow(showOnReady = true) {
  settingsWindow = new BrowserWindow({
    width: 820,
    height: 650,
    minWidth: 680,
    minHeight: 560,
    show: false,
    title: 'Pocket Pause',
    icon: createAppIcon(settings.appearance.iconStyle),
    backgroundColor: '#f4f5f1',
    webPreferences: {
      preload: path.join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  secureWindow(settingsWindow);
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings/index.html'));
  settingsWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
  if (showOnReady) settingsWindow.once('ready-to-show', () => settingsWindow.show());
}

function petPosition() {
  const bounds = screen.getPrimaryDisplay().workArea;
  return { x: bounds.x + bounds.width - PET_WINDOW_SIZE.width - 30, y: bounds.y + bounds.height - PET_WINDOW_SIZE.height - 50 };
}

function visiblePetPosition(position) {
  const center = {
    x: position.x + Math.floor(PET_WINDOW_SIZE.width / 2),
    y: position.y + Math.floor(PET_WINDOW_SIZE.height / 2)
  };
  const bounds = screen.getDisplayNearestPoint(center).workArea;
  return fitWindowToBounds(position, bounds, PET_WINDOW_SIZE);
}

function ensurePetWindowVisible() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [x, y] = petWindow.getPosition();
  const visible = visiblePetPosition({ x, y });
  if (visible.x !== x || visible.y !== y) petWindow.setPosition(visible.x, visible.y);
}

function createPetWindow() {
  const saved = settings.petPosition;
  const fallback = petPosition();
  const position = visiblePetPosition(Number.isInteger(saved?.x) && Number.isInteger(saved?.y) ? saved : fallback);
  petWindow = new BrowserWindow({
    width: PET_WINDOW_SIZE.width,
    height: PET_WINDOW_SIZE.height,
    x: position.x,
    y: position.y,
    transparent: true,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  secureWindow(petWindow);
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadFile(path.join(__dirname, '../renderer/pet/index.html'));
  petWindow.on('moved', () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const [x, y] = petWindow.getPosition();
    settings.petPosition = { x, y };
    store.save(settings);
  });
  petWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      petWindow.hide();
    }
  });
}

function showSettings() {
  if (!settingsWindow) createSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

function sendPetState(state, reminders = []) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send('pet:state', { state, reminders, appearance: settings.appearance });
}

function applyIconStyle() {
  tray?.setImage(createTrayIcon(settings.appearance.iconStyle));
  if (process.platform !== 'darwin' && settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setIcon(createAppIcon(settings.appearance.iconStyle));
  }
}

function showPet(state = pendingReminders.length ? 'reminder' : 'idle') {
  ensurePetWindowVisible();
  petWindow.showInactive();
  sendPetState(state, pendingReminders);
  rebuildTrayMenu();
}

function hidePet() {
  sendPetState('hiding');
  setTimeout(() => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.hide();
    rebuildTrayMenu();
  }, 180);
}

function handleDue(types) {
  pendingReminders = [...new Set([...pendingReminders, ...types])];
  showPet('reminder');
}

function commitSettings(next) {
  const previous = settings;
  const loginChanged = previous.launchAtLogin !== next.launchAtLogin;
  try {
    if (loginChanged) configureLaunchAtLogin(next.launchAtLogin);
    store.save(next);
  } catch (error) {
    if (loginChanged) {
      try {
        configureLaunchAtLogin(previous.launchAtLogin);
      } catch (rollbackError) {
        console.error('Unable to restore login item settings', rollbackError);
      }
    }
    throw error;
  }
  settings = next;
}

function setLaunchAtLogin(enabled) {
  const next = normalizeSettings({ ...settings, launchAtLogin: enabled });
  try {
    commitSettings(next);
  } catch (error) {
    console.error('Unable to save launch-at-login setting', error);
  }
  rebuildTrayMenu();
  settingsWindow?.webContents.send('settings:changed', settings);
}

function rebuildTrayMenu() {
  if (!tray) return;
  const visible = Boolean(petWindow?.isVisible());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? '隐藏宠物' : '展示宠物', click: () => visible ? hidePet() : showPet() },
    { label: '打开设置', click: showSettings },
    { type: 'separator' },
    { label: manuallyPaused ? '恢复提醒' : '暂停提醒', click: () => {
      manuallyPaused = !manuallyPaused;
      scheduler.setPaused(manuallyPaused);
      rebuildTrayMenu();
    } },
    { label: '开机启动', type: 'checkbox', checked: settings.launchAtLogin, click: (item) => setLaunchAtLogin(item.checked) },
    { type: 'separator' },
    { label: '退出 Pocket Pause', click: () => { quitting = true; app.quit(); } }
  ]));
}

function wireIpc() {
  ipcMain.handle('settings:get', (event) => {
    assertIpcSender(event, settingsWindow);
    return { settings, status: scheduler.snapshot() };
  });
  ipcMain.handle('settings:save', (event, input) => {
    assertIpcSender(event, settingsWindow);
    const previousIconStyle = settings.appearance.iconStyle;
    const next = normalizeSettings(input);
    next.petPosition = settings.petPosition;
    try {
      commitSettings(next);
    } catch (error) {
      console.error('Unable to save settings', error);
      throw new Error('Settings could not be saved');
    }
    scheduler.updateSettings(settings);
    if (settings.appearance.iconStyle !== previousIconStyle) applyIconStyle();
    const pendingCount = pendingReminders.length;
    pendingReminders = pendingReminders.filter((type) => settings.reminders[type].enabled);
    if (petWindow?.isVisible() && pendingReminders.length !== pendingCount && !pendingReminders.length) {
      setTimeout(hidePet, 700);
    }
    sendPetState(pendingReminders.length ? 'reminder' : 'idle', pendingReminders);
    rebuildTrayMenu();
    return { settings, status: scheduler.snapshot() };
  });
  ipcMain.on('pet:hide', (event) => {
    if (event.sender === petWindow?.webContents) hidePet();
  });
  ipcMain.on('reminder:action', (event, payload) => {
    if (event.sender !== petWindow?.webContents) return;
    const type = payload?.type;
    const action = payload?.action;
    if (!REMINDER_TYPES.includes(type) || !['complete', 'snooze'].includes(action)) return;
    if (action === 'complete') scheduler.complete(type);
    if (action === 'snooze') scheduler.snooze(type);
    pendingReminders = pendingReminders.filter((item) => item !== type);
    if (pendingReminders.length) sendPetState('reminder', pendingReminders);
    else {
      sendPetState('idle');
      setTimeout(hidePet, 700);
    }
  });
}

function wirePowerEvents() {
  const sync = () => scheduler.setSystemInactive(powerInactive || idleInactive);
  const inactive = () => { powerInactive = true; sync(); };
  const active = () => { powerInactive = false; sync(); };
  powerMonitor.on('suspend', inactive);
  powerMonitor.on('lock-screen', inactive);
  powerMonitor.on('resume', active);
  powerMonitor.on('unlock-screen', active);
}

app.whenReady().then(() => {
  store = new JsonStore(app.getPath('userData'));
  settings = store.load();
  const loginItem = readLoginItemSettings();
  settings.launchAtLogin = isLaunchAtLoginEnabled(loginItem);
  if (settings.launchAtLogin && process.platform === 'win32' && !loginItem.openAtLogin) {
    try {
      configureLaunchAtLogin(true);
    } catch (error) {
      console.error('Unable to migrate login item settings', error);
    }
  }
  scheduler = new ReminderScheduler({ settings, onDue: handleDue });
  createPetWindow();
  createSettingsWindow(!wasStartedAtLogin(loginItem));
  tray = new Tray(createTrayIcon(settings.appearance.iconStyle));
  tray.setToolTip('Pocket Pause');
  tray.on('click', () => petWindow.isVisible() ? hidePet() : showPet());
  rebuildTrayMenu();
  wireIpc();
  wirePowerEvents();
  screen.on('display-removed', ensurePetWindowVisible);
  screen.on('display-metrics-changed', ensurePetWindowVisible);
  timer = setInterval(() => {
    idleInactive = powerMonitor.getSystemIdleTime() >= IDLE_THRESHOLD_SECONDS;
    scheduler.setSystemInactive(powerInactive || idleInactive);
    scheduler.tick();
    settingsWindow?.webContents.send('status:changed', scheduler.snapshot());
  }, 1000);
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  quitting = true;
  clearInterval(timer);
});
app.on('activate', showSettings);

if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', showSettings);
