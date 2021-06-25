import { spawn } from 'child_process'

export const spawnGetStdout = (cmd: string, args: string[]): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    let stdoutString = ''
    let stderrString = ''

    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    proc.stdout.on('data', (line) => {
      if (stdoutString === '') {
        stdoutString = line.toString()
      } else {
        stdoutString += line.toString()
      }
    })
    proc.stderr.on('data', (line) => {
      if (stderrString === '') {
        stderrString = line.toString()
      } else {
        stderrString += line.toString()
      }
    })

    proc.on('close', (code) => {
      if (!code) {
        resolve(stdoutString)
      } else {
        reject(stderrString)
      }
    })
  })
}
