const fs = require('node:fs');
const path = require('node:path');
const { normalizeSettings } = require('../shared/validation');

class JsonStore {
  constructor(userDataPath, fileSystem = fs) {
    this.file = path.join(userDataPath, 'settings.json');
    this.fs = fileSystem;
  }

  load() {
    try {
      return normalizeSettings(JSON.parse(this.fs.readFileSync(this.file, 'utf8')));
    } catch {
      return normalizeSettings();
    }
  }

  save(settings) {
    this.fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    try {
      this.fs.writeFileSync(temporary, JSON.stringify(settings, null, 2), 'utf8');
      this.fs.renameSync(temporary, this.file);
    } catch (error) {
      try {
        this.fs.rmSync(temporary, { force: true });
      } catch {}
      throw error;
    }
  }
}

module.exports = { JsonStore };
