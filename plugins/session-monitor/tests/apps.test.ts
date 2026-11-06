import { describe, expect, test } from 'claude-code/testing'

import {
  appFor,
  chosenApp,
  fileManagerName,
  fromMsysPath,
  isOpenOk,
  isWindowsPath,
  openArgv,
  openLabel,
  toWindowsPath,
  trashName,
  windowsDefaultArgv,
  windowsExplorerArgv,
  windowsOpenArgv,
  windowsTrashArgv,
} from '../hooks/lib/apps'

describe('which app opens a file', () => {
  test('code, config, data and text files open in Cursor', () => {
    const names = [
      'main.py',
      'stubs.pyi',
      'analysis.ipynb',
      'package.json',
      'prices.csv',
      'trades.tsv',
      'index.js',
      'server.mjs',
      'app.ts',
      'next-env.d.ts',
      'Page.jsx',
      'Page.tsx',
      'Main.java',
      'build.gradle',
      'go.mod',
      'lib.rs',
      'run.sh',
      'styles.css',
      'README.md',
      'notes.txt',
      'config.yaml',
      'pyproject.toml',
      'query.sql',
      'yarn.lock',
      'Dockerfile',
      'Dockerfile.dev',
      'Makefile',
      'LICENSE',
      '.gitignore',
      '.eslintrc',
      '.env',
      '.env.local',
    ]
    expect(names.filter(name => appFor(`/repo/${name}`)?.app !== 'Cursor')).toEqual([])
  })

  test('web pages open in Chrome, whatever the case of their extension', () => {
    expect(['index.html', 'PAGE.HTM', 'doc.xhtml'].map(name => appFor(`/repo/${name}`)?.app)).toEqual(['Google Chrome', 'Google Chrome', 'Google Chrome'])
  })

  test('anything else opens in the app macOS picks', () => {
    const names = ['logo.png', 'report.pdf', 'archive.zip', 'movie.mov', 'LICENSE.pdf', '.DS_Store', '.hidden.png', 'a-binary', 'icon.svg']
    expect(names.filter(name => appFor(`/repo/${name}`) !== undefined)).toEqual([])
  })

  test('the button names the app; a folder opens in Finder; a reveal selects the entry in Finder', () => {
    expect([openLabel('/repo/app.py'), openLabel('/repo/index.html'), openLabel('/repo/logo.png')]).toEqual(['Open in Cursor', 'Open in Chrome', 'Open in app'])
    expect(openArgv('/repo/app.py', false, false)).toEqual(['open', '-a', 'Cursor', '/repo/app.py'])
    expect(openArgv('/repo/index.html', false, false)).toEqual(['open', '-a', 'Google Chrome', '/repo/index.html'])
    expect(openArgv('/repo/logo.png', false, false)).toEqual(['open', '/repo/logo.png'])
    expect(openArgv('/repo/src.py', false, true)).toEqual(['open', '/repo/src.py'])
    expect(openArgv('/repo/app.py', true, false)).toEqual(['open', '-R', '/repo/app.py'])
  })
})

describe('the same buttons on Windows', () => {
  test('a Windows path is told by its drive or a UNC prefix, a folder of the plugin or the session alike', () => {
    expect(isWindowsPath('C:\\Users\\me\\plugin')).toBe(true)
    expect(isWindowsPath('c:/Users/me/plugin')).toBe(true)
    expect(isWindowsPath('\\\\server\\share')).toBe(true)
    expect(isWindowsPath('/Users/me/plugin')).toBe(false)
    expect(toWindowsPath('C:/Users/me/a b.txt')).toBe('C:\\Users\\me\\a b.txt')
  })

  test('a file opens through start in its app, else through PowerShell; a folder and a reveal go to Explorer', () => {
    expect(windowsOpenArgv('C:/repo/app.py', false, false)).toEqual(['cmd.exe', '/d', '/c', 'start', '', 'cursor', 'C:\\repo\\app.py'])
    expect(windowsOpenArgv('C:/repo/index.html', false, false)).toEqual(['cmd.exe', '/d', '/c', 'start', '', 'chrome', 'C:\\repo\\index.html'])
    expect(windowsOpenArgv('C:/repo/logo.png', false, false)).toEqual(windowsDefaultArgv('C:/repo/logo.png'))
    expect(windowsDefaultArgv("C:/repo/it's.png")[4]).toBe("Invoke-Item -LiteralPath 'C:\\repo\\it''s.png'")
    expect(windowsOpenArgv('C:/repo/src', false, true)).toEqual(windowsExplorerArgv('C:/repo/src', false))
    expect(windowsOpenArgv('C:/repo/app.py', true, false)).toEqual(windowsExplorerArgv('C:/repo/app.py', true))
  })

  test('Explorer is started by PowerShell, which quotes the path for it and brings its window to the front', () => {
    const [exe, , , flag, script = ''] = windowsExplorerArgv("C:/my repo/it's.pdf", true)
    expect([exe, flag]).toEqual(['powershell.exe', '-Command'])
    expect(script).toContain("$p = 'C:\\my repo\\it''s.pdf'")
    expect(script).toContain(`'/select,"' + $p + '"'`)
    expect(script).toContain('SetForegroundWindow')
    const folder = windowsExplorerArgv('C:/my repo', false)[4] ?? ''
    expect(folder).toContain(`'"' + $p + '"'`)
    expect(folder).toContain('$dir = $p')
    expect(script).toContain('GetDirectoryName($p)')
  })

  test('the app a command chose is read back, and Explorer answering 1 is a success', () => {
    expect(chosenApp(windowsOpenArgv('C:/repo/app.py', false, false))).toBe('Cursor')
    expect(chosenApp(windowsOpenArgv('C:/repo/index.html', false, false))).toBe('Google Chrome')
    expect(chosenApp(windowsOpenArgv('C:/repo/logo.png', false, false))).toBeUndefined()
    expect(chosenApp(openArgv('/repo/app.py', false, false))).toBe('Cursor')
    expect(isOpenOk(['explorer.exe', 'C:\\repo'], 1)).toBe(true)
    expect(isOpenOk(['cmd.exe'], 1)).toBe(false)
    expect(isOpenOk(['open', '/repo'], 0)).toBe(true)
  })

  test('a delete moves a file or folder to the Recycle Bin, the path quoted for PowerShell', () => {
    const argv = windowsTrashArgv("C:/repo/it's here")
    expect(argv.slice(0, 4)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command'])
    expect(argv[4]).toContain("$p = 'C:\\repo\\it''s here'")
    expect(argv[4]).toContain('SendToRecycleBin')
  })

  test('the buttons name the platform\'s file manager and trash', () => {
    expect(fileManagerName(true)).toBe('File Explorer')
    expect(fileManagerName(false)).toBe('Finder')
    expect(trashName(true)).toBe('Recycle Bin')
    expect(trashName(false)).toBe('Trash')
  })

  test('a Git Bash path becomes the drive path Explorer needs; any other path is left as it is', () => {
    expect(fromMsysPath('/c/Users/me/a b.pdf')).toBe('C:/Users/me/a b.pdf')
    expect(fromMsysPath('/d')).toBe('D:/')
    expect(fromMsysPath('C:/Users/me')).toBe('C:/Users/me')
    expect(fromMsysPath('/repo/src')).toBe('/repo/src')
    expect(windowsOpenArgv(fromMsysPath('/c/Users/me/a.pdf'), true, false)[4]).toContain("$p = 'C:\\Users\\me\\a.pdf'")
  })
})
