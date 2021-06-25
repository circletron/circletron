import { spawn } from 'child_process'

export const spawnGetStdout = (cmd: string, args: string[]): Promise<string> => {
  return new Promise<string>((resolve) => {
    let allLines = ''
    const { stdout } = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    stdout.on('data', (line) => {
      if (allLines === '') {
        allLines = line.toString()
      } else {
        allLines += line.toString()
      }
    })

    stdout.on('end', () => {
      resolve(allLines)
    })
  })
}
