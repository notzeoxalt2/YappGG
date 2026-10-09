const assert = require('assert/strict');
const prepareInstaller = require('./prepare-installer.cjs');
// Route both of electron-builder's normal installer/uninstaller compilation passes
// through our generated headers. No dependency files are edited on disk.
const templates = require('app-builder-lib/out/targets/nsis/nsisUtil');
assert.equal(typeof templates.nsisTemplatesDir, 'string', 'Review NSIS integration after builder upgrades');
const prepared = prepareInstaller();
templates.nsisTemplatesDir = prepared.output;
assert.equal(templates.nsisTemplatesDir, prepared.output);
