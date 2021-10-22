import { spawn } from 'child_process'

import { spawnGetStdout } from './command'

interface CommitAndTargetBranch {
  commit: string
  targetBranch?: string
}

export const getBranchpointCommitAndTargetBranch = async (
  mainBranchRegex: RegExp,
): Promise<CommitAndTargetBranch> => {
  const logProc = spawn('git', ['log', '--pretty=format:%h'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  return new Promise<CommitAndTargetBranch>((resolve, reject) => {
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
        const targetBranch = stdout
          .trim()
          .split('\n')
          .find((refname) => mainBranchRegex.test(refname))
        if (targetBranch) {
          finish()
          resolve({ commit, targetBranch })
          return
        }
      }

      processingCommits = false
      const nextBuffer = commitBuffers.shift()
      if (nextBuffer) {
        onLogData(nextBuffer)
      } else if (noMoreCommits) {
        resolve({ commit: lastCommit })
      }
    }

    logProc.stdout.on('data', onLogData)

    logProc.stdout.on('end', () => {
      noMoreCommits = true
      if (!finished && !processingCommits) {
        finish()
        if (lastCommit) {
          resolve({ commit: lastCommit })
        } else {
          reject(new Error('Could not find branchpoint'))
        }
      }
    })
  })
}
