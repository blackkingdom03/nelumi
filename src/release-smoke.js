// Opt-in release verification. Always uses a newly created, isolated profile.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function install(profile) {
  const timer = setTimeout(() => { console.error('Release smoke test timed out'); app.exit(1); }, 120000);
  app.once('browser-window-created', (_event, window) => {
    window.webContents.once('did-finish-load', async () => {
      try {
        const result = await window.webContents.executeJavaScript(`(async () => {
          for (let i = 0; i < 100 && document.querySelectorAll('.day-cell').length !== 42; i++) await new Promise(r => setTimeout(r, 50));
          const before = await window.deskcal.getState();
          if (before.events.length) throw Error('Test profile is not empty');
          await window.deskcal.saveEvents([{ id: 'release-smoke', title: 'Release test', date: '2026-11-05', allDay: true, calendarId: before.calendars[0].id, location: 'Test room' }]);
          const saved = await window.deskcal.getState();
          const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 240;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1000, 240);
          ctx.fillStyle = 'black'; ctx.font = '48px sans-serif';
          ctx.fillText('Meeting 2026-11-05', 30, 80); ctx.fillText('15:00 Room 204', 30, 160);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          const ocr = await NelumiNoticeOCR.start(new File([blob], 'test.png', { type: 'image/png' })).promise;
          return { platform: saved.platform, days: document.querySelectorAll('.day-cell').length, saved: saved.events[0].title, ocr: ocr.text, profile: saved.dataPath };
        })()`);
        assert.equal(result.days, 42);
        assert.equal(result.saved, 'Release test');
        assert.match(result.ocr, /2026-11-05/);
        assert.match(result.ocr, /15:00/);
        assert.equal(result.profile, path.join(profile, 'deskcal-data.json'));
        assert.equal(JSON.parse(fs.readFileSync(result.profile, 'utf8')).events[0].title, 'Release test');
        console.log('NELUMI_RELEASE_TEST_OK ' + JSON.stringify(result));
        clearTimeout(timer);
        app.exit(0);
      } catch (error) {
        console.error(error); clearTimeout(timer); app.exit(1);
      }
    });
  });
}
module.exports = { install };
