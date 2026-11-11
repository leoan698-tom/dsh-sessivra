import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { importHome } from './import-source.js';
const exec = promisify(execFile);
const script = Buffer.from(`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[Windows.Forms.Application]::EnableVisualStyles()
$owner = [Windows.Forms.Form]::new()
$owner.Text = $env:SESSIVRA_PICK_TITLE
$owner.FormBorderStyle = [Windows.Forms.FormBorderStyle]::None
$owner.StartPosition = [Windows.Forms.FormStartPosition]::CenterScreen
$owner.Width = 8
$owner.Height = 8
$owner.Opacity = 0.01
$owner.TopMost = $true
$dialog = [Windows.Forms.OpenFileDialog]::new()
try {
  $dialog.Title = $env:SESSIVRA_PICK_TITLE
  $dialog.Filter = $env:SESSIVRA_PICK_FILTER
  $dialog.InitialDirectory = $env:SESSIVRA_PICK_DIRECTORY
  $dialog.CheckFileExists = $true
  $dialog.RestoreDirectory = $true
  $owner.Show()
  $owner.Activate()
  if ($dialog.ShowDialog($owner) -eq [Windows.Forms.DialogResult]::OK) {
    [Console]::Write($dialog.FileName)
  }
} finally {
  $dialog.Dispose()
  $owner.Dispose()
}
`, 'utf16le').toString('base64');
export async function pickImportFile(query, signal) {
    const memory = query.kind === 'memory';
    const codex = query.source === 'codex';
    const root = importHome(query.source);
    const fallback = memory ? root : join(root, codex ? 'sessions' : 'projects');
    const start = query.path && isAbsolute(query.path) ? query.path : fallback;
    const initial = (await stat(start).catch(() => null))?.isDirectory() ? start : dirname(start);
    const directory = (await stat(initial).catch(() => null))?.isDirectory() ? initial : homedir();
    const filter = memory ? 'Markdown (*.md)|*.md' : codex
        ? 'Codex (*.jsonl; *.jsonl.zst)|*.jsonl;*.jsonl.zst' : 'Claude Code (*.jsonl)|*.jsonl';
    const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const { stdout } = await exec(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-STA', '-EncodedCommand', script], {
        signal, encoding: 'utf8', timeout: 5 * 60_000,
        env: {
            ...process.env,
            SESSIVRA_PICK_TITLE: memory ? '选择记忆文件' : '选择会话原档',
            SESSIVRA_PICK_FILTER: filter,
            SESSIVRA_PICK_DIRECTORY: directory,
        },
    }).catch(() => {
        throw new Error('Windows 文件选择窗口未能完成。请重试，或直接粘贴文件路径。');
    });
    return stdout || null;
}
