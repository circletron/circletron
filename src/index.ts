#!/usr/bin/env node

import { readFile } from 'fs'
import { promisify } from 'util'
import axios from 'axios'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { join as pathJoin } from 'path'

import { getBranchpointCommit, getLastCommitOnBranch } from './git'
import { spawnGetStdout } from './command'

const CONTINUATION_API_URL = `https://circleci.com/api/v2/pipeline/continue`
const DEFAULT_CONFIG_VERSION = 2.1
const DEFAULT_TARGET_BRANCHES_REGEX = /^(release\/|develop$|main$|master$)/
const DEFAULT_RUN_ALL_ON_TARGET_BRANCHES = true

const pReadFile = promisify(readFile)

const requireEnv = (varName: string): string => {
  const value = process.env[varName]
  if (!value) {
    throw new Error(`Environment variable ${varName} must be set`)
  }
  return value
}

interface CircleConfig {
  dependencies?: string[]
  [k: string]: unknown
}

interface Package {
  name: string
  circleConfig: CircleConfig
}

interface CircletronConfig {
  runAllOnTargetBranches: boolean
  targetBranchesRegex: RegExp
}

async function getPackages(): Promise<Package[]> {
  const packageOutput = await spawnGetStdout('lerna', ['list', '--parseable', '--all', '--long'])
  const allPackages = await Promise.all(
    packageOutput
      .trim()
      .split('\n')
      .map(async (line) => {
        const [fullPath, name] = line.split(':')
        let circleConfig: CircleConfig | undefined
        try {
          circleConfig = yamlParse((await pReadFile(pathJoin(fullPath, 'circle.yml'))).toString())
        } catch (e) {
          // no circle config, filter below
        }

        return { circleConfig, name }
      }),
  )

  function hasConfig(pkg: { circleConfig?: CircleConfig }): pkg is Package {
    return !!pkg.circleConfig
  }
  return allPackages.filter(hasConfig)
}

/**
 * Get the names of the packages which builds should be triggered for by
 * determing which packages have changed in this branch and consulting
 * .circleci/circletron.yml to packages that should be run due to a dependency
 * changing.
 */
const getTriggerPackages = async (
  packages: Package[],
  config: CircletronConfig,
  branch: string,
): Promise<Set<string>> => {
  // run all jobs on target branches
  const isTargetBranch = config.targetBranchesRegex.test(branch)
  const changedPackages = new Set<string>()
  const allPackageNames = new Set(packages.map((pkg) => pkg.name))

  let changesSinceCommit: string

  if (isTargetBranch && config.runAllOnTargetBranches) {
    console.log(`Detected a push from ${branch}, running all pipelines`)
    return allPackageNames
  } else if (isTargetBranch) {
    changesSinceCommit = await getLastCommitOnBranch()
  } else {
    changesSinceCommit = await getBranchpointCommit(config.targetBranchesRegex)
  }

  console.log("Looking for changes since `%s'", changesSinceCommit)
  const changeOutput = (
    await spawnGetStdout('lerna', [
      'list',
      '--parseable',
      '--all',
      '--long',
      '--since',
      changesSinceCommit,
    ])
  ).trim()

  if (!changeOutput) {
    console.log('Found no changed packages')
  } else {
    for (const pkg of changeOutput.split('\n')) {
      changedPackages.add(pkg.split(':', 2)[1])
    }

    console.log('Found changes: %O', changedPackages)
  }

  return new Set(
    Array.from(changedPackages)
      .flatMap((changedPackage) => [
        changedPackage,
        ...packages
          .filter((pkg) => pkg.circleConfig.dependencies?.includes(changedPackage))
          .map((pkg) => pkg.name),
      ])
      .filter((pkg) => allPackageNames.has(pkg)),
  )
}

const SKIP_JOB = {
  docker: [{ image: 'busybox:stable' }],
  steps: [
    {
      run: {
        name: 'Jobs not required',
        command: 'echo "Jobs not required"',
      },
    },
  ],
}

async function buildConfiguration(
  packages: Package[],
  triggerPackages: Set<string>,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let config: Record<string, any> = {}
  try {
    config = yamlParse((await pReadFile('circle.yml')).toString())
  } catch (e) {
    // the root config does not have to exist
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergeObject = (path: string, projectYaml: any): void => {
    for (const [name, value] of Object.entries(projectYaml[path] ?? {})) {
      if (!config[path]) {
        config[path] = {}
      } else if (config[path][name]) {
        throw new Error(`Two ${path} with the same name: ${name}`)
      }
      config[path][name] = value
    }
  }
  if (!config.jobs) {
    config.jobs = {}
  }
  if (!config.version) {
    config.version = DEFAULT_CONFIG_VERSION
  }
  const jobsConfig = config.jobs

  for (const pkg of packages) {
    const { circleConfig } = pkg

    mergeObject('workflows', circleConfig)
    mergeObject('orbs', circleConfig)
    mergeObject('executors', circleConfig)
    mergeObject('commands', circleConfig)

    // jobs may be missing from circle config if all workflow jobs are from orbs
    const jobs = circleConfig.jobs as Record<string, { conditional?: boolean }>
    for (const [jobName, jobData] of Object.entries(jobs ?? {})) {
      if (jobsConfig[jobName]) {
        throw new Error(`Two jobs with the same name: ${jobName}`)
      }
      if ('conditional' in jobData) {
        const { conditional } = jobData
        delete jobData.conditional
        if (conditional === false) {
          // these jobs are triggered no matter what
          jobsConfig[jobName] = jobData
          continue
        }
      }
      jobsConfig[jobName] = triggerPackages.has(pkg.name) ? jobData : SKIP_JOB
    }
  }
  return yamlStringify(config)
}

export async function getCircletronConfig(): Promise<CircletronConfig> {
  let rawConfig: { targetBranches?: string, runAllOnTargetBranches?: boolean } = {}
  try {
    rawConfig = yamlParse((await pReadFile(pathJoin('.circleci', 'circletron.yml'))).toString())
  } catch (e) {
    // circletron.yml is not mandatory
  }

  return {
    runAllOnTargetBranches: rawConfig.runAllOnTargetBranches !== undefined
      ? rawConfig.runAllOnTargetBranches
      : DEFAULT_RUN_ALL_ON_TARGET_BRANCHES,
    targetBranchesRegex: rawConfig.targetBranches
      ? new RegExp(rawConfig.targetBranches)
      : DEFAULT_TARGET_BRANCHES_REGEX,
  }
}

export async function triggerCiJobs(branch: string, continuationKey: string): Promise<void> {
  const lernaConfig = await getCircletronConfig()
  const packages = await getPackages()
  const triggerPackages = await getTriggerPackages(packages, lernaConfig, branch)

  const configuration = await buildConfiguration(packages, triggerPackages)
  const body = { 'continuation-key': continuationKey, configuration }
  console.log('CircleCI configuration:')
  console.log(configuration)

  const response = await axios.post(CONTINUATION_API_URL, body)
  console.log('CircleCI response: %O', response.data)
}

if (require.main === module) {
  const branch = requireEnv('CIRCLE_BRANCH')
  const continuationKey = requireEnv('CIRCLE_CONTINUATION_KEY')

  triggerCiJobs(branch, continuationKey).catch((err) => {
    console.warn('Got error: %O', err)
    process.exit(1)
  })
}
