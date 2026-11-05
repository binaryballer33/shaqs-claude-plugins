// Which app opens a file from the pane's Open buttons: code, config, data and
// text files in Cursor, web pages in Chrome, anything else (an image, a PDF,
// a folder) in the app macOS picks for it. Pure: no `$`.

/** An app as `open -a` names it, and the short name its button says. */
export type OpenApp = { app: string; label: string }

/** Where code and text files open. */
export const CODE_APP: OpenApp = { app: 'Cursor', label: 'Cursor' }
/** Where web pages open. */
export const WEB_APP: OpenApp = { app: 'Google Chrome', label: 'Chrome' }

const WEB_EXTENSIONS: ReadonlySet<string> = new Set(['html', 'htm', 'xhtml'])

/** Extensions of files read and written as text in an editor: source, config, data, docs, logs. */
const CODE_EXTENSIONS: ReadonlySet<string> = new Set([
  // Python
  'py', 'pyi', 'pyw', 'pyx', 'pxd', 'ipynb',
  // JavaScript and TypeScript, and the frameworks' own files
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro',
  // Data and config
  'json', 'jsonc', 'json5', 'jsonl', 'ndjson', 'csv', 'tsv', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'properties', 'xml', 'xsd', 'lock', 'sql', 'graphql', 'gql', 'proto', 'prisma', 'editorconfig',
  // JVM
  'java', 'kt', 'kts', 'scala', 'sc', 'groovy', 'gradle', 'clj', 'cljs', 'edn',
  // C family, Apple
  'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'hxx', 'ino', 'cs', 'csx', 'fs', 'fsx', 'swift', 'm', 'mm',
  // Other languages
  'go', 'mod', 'sum', 'rs', 'rb', 'erb', 'rake', 'php', 'pl', 'pm', 'lua', 'r', 'rmd', 'jl', 'dart', 'ex', 'exs',
  'erl', 'hrl', 'hs', 'ml', 'mli', 'elm', 'zig', 'nim', 'sol', 'vb', 'v', 'sv', 'vhd', 'asm', 's', 'wat',
  // Shell
  'sh', 'bash', 'zsh', 'fish', 'ksh', 'ps1', 'psm1', 'bat', 'cmd', 'awk',
  // Styles and templates
  'css', 'scss', 'sass', 'less', 'styl', 'pcss', 'hbs', 'handlebars', 'mustache', 'ejs', 'pug', 'njk', 'liquid', 'jinja', 'j2', 'twig',
  // Docs and text
  'md', 'mdx', 'markdown', 'rst', 'adoc', 'txt', 'text', 'log', 'tex', 'bib', 'org',
  // Build and infrastructure
  'tf', 'tfvars', 'hcl', 'nix', 'mk', 'cmake', 'bzl', 'bazel', 'dockerfile', 'containerfile', 'service',
  // Changes
  'diff', 'patch',
])

/** Files known by their whole name, with no extension or one that says nothing (`Dockerfile`, `Makefile`). */
const CODE_NAMES: ReadonlySet<string> = new Set([
  'dockerfile', 'containerfile', 'makefile', 'gnumakefile', 'justfile', 'taskfile', 'procfile', 'gemfile', 'rakefile',
  'podfile', 'brewfile', 'vagrantfile', 'jenkinsfile', 'pipfile', 'license', 'licence', 'readme', 'changelog',
  'codeowners', 'authors', 'notice', 'copying',
])

/** What follows a dotfile's own name in a variant of it (`.env.local`, `.npmrc.example`). */
const DOTFILE_SUFFIXES: ReadonlySet<string> = new Set(['local', 'dev', 'development', 'prod', 'production', 'staging', 'test', 'example', 'sample', 'template', 'defaults', 'dist', 'bak', 'orig'])

/** Dotfiles that are not text. */
const BINARY_DOTFILES: ReadonlySet<string> = new Set(['.ds_store', '.localized'])

/** A file's name, lowercased, from its path. */
const nameOf = (path: string): string => (path.split('/').pop() ?? '').toLowerCase()

/** The app a file opens in from the pane; undefined for the one macOS picks. */
export const appFor = (path: string): OpenApp | undefined => {
  const name = nameOf(path)
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1) : ''
  if (WEB_EXTENSIONS.has(extension)) {
    return WEB_APP
  }
  // A dotfile (`.gitignore`, `.eslintrc`, `.env.local`) is config text; not `.DS_Store`, nor a hidden image.
  const isDotfile = name.startsWith('.') && name.length > 1 && !BINARY_DOTFILES.has(name) && (dot === 0 || DOTFILE_SUFFIXES.has(extension))
  // A known name counts alone (`LICENSE`, not `LICENSE.pdf`); a Dockerfile keeps its suffix (`Dockerfile.dev`).
  const isNamed = CODE_NAMES.has(name) || name.startsWith('dockerfile.')
  return CODE_EXTENSIONS.has(extension) || isDotfile || isNamed ? CODE_APP : undefined
}

/** What a file's Open button says: the app it opens in. */
export const openLabel = (path: string): string => `Open in ${appFor(path)?.label ?? 'app'}`

/**
 * The `open` command line for a path: `-R` reveals it in Finder; a folder
 * opens in Finder; a file in its app (lib/apps.ts appFor), else the one
 * macOS picks for it.
 */
export const openArgv = (path: string, isReveal: boolean, isFolder: boolean): string[] => {
  if (isReveal) {
    return ['open', '-R', path]
  }
  const chosen = isFolder ? undefined : appFor(path)
  return chosen === undefined ? ['open', path] : ['open', '-a', chosen.app, path]
}

// ------------------------------------------------------------------------- //
// Windows: the same buttons through Explorer, `start` and PowerShell
// ------------------------------------------------------------------------- //

/** Whether a path (the plugin's folder, the session's) is a Windows one: a drive letter or a UNC prefix. */
export const isWindowsPath = (path: string): boolean => /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')

/** What the platform's file manager is called: Explorer on Windows, the Finder on a Mac. */
export const fileManagerName = (isWindows: boolean): string => (isWindows ? 'File Explorer' : 'Finder')

/** What the platform calls where deleted files go. */
export const trashName = (isWindows: boolean): string => (isWindows ? 'Recycle Bin' : 'Trash')

/** A Git Bash path (`/c/Users/me`) as the drive path (`C:/Users/me`) Explorer needs; any other path as it is. */
export const fromMsysPath = (path: string): string => {
  const match = /^\/([A-Za-z])(\/.*)?$/.exec(path)
  return match === null ? path : `${(match[1] ?? '').toUpperCase()}:${match[2] ?? '/'}`
}

/** A path with the backslashes Windows programs expect. */
export const toWindowsPath = (path: string): string => path.replace(/\//g, '\\')

/** Text as one PowerShell single-quoted string. */
export const psQuote = (text: string): string => `'${text.replace(/'/g, "''")}'`

/** The command each app answers to on Windows (`start` finds it on the PATH or in the registry's App Paths). */
const WINDOWS_COMMANDS: Readonly<Record<string, string>> = { Cursor: 'cursor', 'Google Chrome': 'chrome' }

/** What opens `path` in the app Windows picks for it: PowerShell's `Invoke-Item`. */
export const windowsDefaultArgv = (path: string): string[] => [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  `Invoke-Item -LiteralPath ${psQuote(toWindowsPath(path))}`,
]

/**
 * Shows a path in File Explorer (`isSelect`: its folder with it selected; else
 * the folder itself) and brings that window to the front. Explorer started
 * by a background process opens behind the app, so the button seemed to do
 * nothing: PowerShell finds the window once it is up and raises it. The path
 * is quoted for Explorer too (`/select,"C:\a b\c.txt"`), which it needs.
 */
export const windowsExplorerArgv = (path: string, isSelect: boolean): string[] => {
  const native = psQuote(toWindowsPath(path))
  const script = [
    `$p = ${native}`,
    isSelect ? `Start-Process -FilePath explorer.exe -ArgumentList ('/select,"' + $p + '"')` : `Start-Process -FilePath explorer.exe -ArgumentList ('"' + $p + '"')`,
    isSelect ? '$dir = [IO.Path]::GetDirectoryName($p)' : '$dir = $p',
    `Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);'`,
    '$shell = New-Object -ComObject Shell.Application',
    'for ($i = 0; $i -lt 25; $i++) {',
    '  Start-Sleep -Milliseconds 120',
    '  $w = @($shell.Windows() | Where-Object { try { $_.Document.Folder.Self.Path -ieq $dir } catch { $false } }) | Select-Object -Last 1',
    // A tap of Alt lets a background process take the foreground.
    '  if ($w) { [W.U]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W.U]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero); [W.U]::ShowWindow([IntPtr]$w.HWND, 9) | Out-Null; [W.U]::SetForegroundWindow([IntPtr]$w.HWND) | Out-Null; break }',
    '}',
  ].join('; ')
  return ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script]
}

/**
 * The command line for a path on Windows: Explorer with it selected, a folder
 * in Explorer, a file in its app through `start`, else the app Windows picks.
 */
export const windowsOpenArgv = (path: string, isReveal: boolean, isFolder: boolean): string[] => {
  const native = toWindowsPath(path)
  if (isReveal) {
    return windowsExplorerArgv(path, true)
  }
  if (isFolder) {
    return windowsExplorerArgv(path, false)
  }
  const command = WINDOWS_COMMANDS[appFor(path)?.app ?? '']
  return command === undefined ? windowsDefaultArgv(path) : ['cmd.exe', '/d', '/c', 'start', '', command, native]
}

/** The app a command line chose (its name), or undefined where it is the system's own pick. */
export const chosenApp = (argv: readonly string[]): string | undefined => {
  if (argv[0] === 'cmd.exe') {
    return Object.entries(WINDOWS_COMMANDS).find(([, command]) => command === argv[5])?.[0]
  }
  return argv[1] === '-a' ? argv[2] : undefined
}

/** Explorer answers 1 whatever it did, so for it 0 and 1 are both a success. */
export const isOpenOk = (argv: readonly string[], exitCode: number): boolean => exitCode === 0 || (argv[0] === 'explorer.exe' && exitCode === 1)

/** Moves a file or folder to the Recycle Bin, with PowerShell's .NET call. */
export const windowsTrashArgv = (path: string): string[] => {
  const target = psQuote(toWindowsPath(path))
  return [
    'powershell.exe',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Add-Type -AssemblyName Microsoft.VisualBasic; $p = ${target}; ` +
      `if (Test-Path -LiteralPath $p -PathType Container) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin') } ` +
      `else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin') }`,
  ]
}
