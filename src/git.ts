import { spawn } from 'child_process'

import { spawnGetStdout } from './command'

export const getBranchpointCommit = async (mainBranchRegex: RegExp): Promise<string> => {
  const logProc = spawn('git', ['log', '--pretty=format:%h'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  return new Promise<string>((resolve, reject) => {
    let finished = false
    const finish = () => {
      if (!finished) {
        if (!logProc.killed) {
          logProc.kill()
        }
        logProc.stdout.off('data', onLogData)
        finished = true
      }
    }

    const onLogData = async (commits: Buffer) => {
      for (const commit of commits.toString().trim().split('\n')) {
        const stdout = await spawnGetStdout('git', [
          'branch',
          '--contains',
          commit,
          '--format=%(refname:short)',
        ])
        if (
          stdout
            .trim()
            .split('\n')
            .some((refname) => mainBranchRegex.test(refname))
        ) {
          finish()
          resolve(commit)
        }
      }
    }

    logProc.stdout.on('data', onLogData)

    logProc.stdout.on('end', () => {
      if (!finished) {
        finish()
        reject(new Error('Could not find branchpoint'))
      }
    })
  })
}
