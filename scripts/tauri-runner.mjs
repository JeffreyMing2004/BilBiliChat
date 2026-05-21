import { spawn } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
const isMacDev = process.platform === 'darwin' && args[0] === 'dev'
const hasCustomConfig = args.includes('--config')
const tauriArgs = isMacDev && !hasCustomConfig
  ? [...args, '--config', 'src-tauri/tauri.dev.conf.json']
  : args
const isWindows = process.platform === 'win32'
const tauriBin = isWindows ? 'cmd.exe' : 'tauri'
const tauriCommandArgs = isWindows ? ['/c', 'tauri.cmd', ...tauriArgs] : tauriArgs

const child = spawn(tauriBin, tauriCommandArgs, {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
