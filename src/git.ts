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

    const commitBuffers: Buffer[] = []

    let lastCommit = ''
    let noMoreCommits = false
    let processingCommits = false
    const onLogData = async (commits: Buffer) => {
      if (processingCommits) {
        commitBuffers.push(commits)
        return
      }

      processingCommits = true
      for (const commit of commits.toString().trim().split('\n')) {
        lastCommit = commit
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
          return
        }
      }

      processingCommits = false
      const nextBuffer = commitBuffers.shift()
      if (nextBuffer) {
        onLogData(nextBuffer)
      } else if (noMoreCommits) {
        resolve(lastCommit)
      }
    }

    logProc.stdout.on('data', onLogData)

    logProc.stdout.on('end', () => {
      noMoreCommits = true
      if (!finished && !processingCommits) {
        finish()
        if (lastCommit) {
          resolve(lastCommit)
        } else {
          reject(new Error('Could not find branchpoint'))
        }
      }
    })
  })
}

export const getLastCommitOnBranch = async (): Promise<string> => {
  const stdout = await spawnGetStdout('git', ['log', '-n', '2', '--pretty=format:%h'])

  if (stdout.trim().split('\n').length > 1) {
    return stdout.trim().split('\n')[1]
  }

  throw new Error('Could not find last commit on branch')
}
