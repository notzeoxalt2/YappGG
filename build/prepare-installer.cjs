const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

// Use a generated copy: keep electron-builder's installed templates untouched.
function prepareInstaller() {
  const source = path.join(path.dirname(require.resolve('app-builder-lib/package.json')), 'templates/nsis');
  const output = path.join(__dirname, 'nsis-generated');
  fs.cpSync(source, output, { recursive: true });
  const files = [];
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (/\.(nsi|nsh)$/.test(entry.name)) files.push(file);
    }
  }
  collect(source);
  let removed = 0;
  for (const file of files) {
    let script = fs.readFileSync(file, 'utf8');
    script = script.replace(/^[\t ]*WinShell::[^\r\n]*(?:\r?\n|$)/gm, () => { removed++; return ''; });
    script = script.replace(/^([\t ]*!include\s+)(?:"([^"\r\n]+)"|([^\s\r\n]+))/gm, (line, prefix, quoted, bare) => {
      const name = quoted || bare;
      const candidate = [path.resolve(path.dirname(file), name), path.resolve(source, name), path.resolve(source, 'include', name)]
        .find(item => files.includes(item));
      if (!candidate) return line; // NSIS standard headers remain resolved by NSIS.
      return prefix + '"' + path.join(output, path.relative(source, candidate)) + '"';
    });
    assert(!/WinShell::/.test(script), 'Unexpected WinShell invocation: ' + file);
    const target = path.join(output, path.relative(source, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, script);
  }
  assert.equal(removed, 10, 'NSIS template changed: review optional shortcut calls before release');
  const shortcuts = fs.readFileSync(path.join(output, 'include/installer.nsh'), 'utf8');
  assert(shortcuts.includes('CreateShortCut'), 'Keep normal shortcut creation');
  const uninstall = fs.readFileSync(path.join(output, 'uninstaller.nsh'), 'utf8');
  assert(uninstall.includes('Delete "$oldDesktopLink"') && uninstall.includes('Delete "$oldStartMenuLink"'), 'Keep shortcut removal');
  console.log(`Prepared NSIS installer without ${removed} optional WinShell calls.`);
  return { output, removed, files: files.length };
}
if (require.main === module) prepareInstaller();
module.exports = prepareInstaller;
