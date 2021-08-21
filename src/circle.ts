import axios from 'axios'

import { requireEnv } from './env'

const CIRCLE_API_URL = 'https://circleci.com/api/v2'

interface CirclePipelineError {
  type: string
  message: string
}

interface CirclePipelineVCSInfo {
  // Name of the VCS provider
  provider_name: 'GitHub' | 'Bitbucket'

  // The code revision the pipeline ran
  revision: string
}

enum CirclePipelineState {
  Created = 'created',
  Errored = 'errored',
  SetupPending = 'setup-pending',
  Setup = 'setup',
  Pending = 'pending',
}

interface CirclePipelineItem {
  // The unique ID of the pipeline
  id: string

  // A sequence of errors that have occurred within the pipeline
  errors: CirclePipelineError[]

  // The current state of the pipeline
  state: CirclePipelineState

  // VCS information for the pipeline
  vcs: CirclePipelineVCSInfo
}

interface CirclePipelines {
  // A list of pipelines
  items: CirclePipelineItem[]
}

enum CircleWorkflowStatus {
  Success = 'success',
  Running = 'running',
  NotRun = 'not_run',
  Failed = 'failed',
  Error = 'error',
  Failing = 'failing',
  OnHold = 'on_hold',
  Canceled = 'canceled',
  Unauthorized = 'unauthorized',
}

interface CircleWorkflowItem {
  // The unique ID of the workflow
  id: string

  // The current status of the workflow
  status: CircleWorkflowStatus
}

interface CircleWorkflows {
  // A list of workflows
  items: CircleWorkflowItem[]
}

async function find<I>(items: I[], asyncCallback: (input: I) => Promise<boolean>): Promise<I | null> {
  for (const element of items) {
    const shouldReturn: boolean = await asyncCallback(element)
    if (shouldReturn) return element
  }

  return null
}

/**
 * This method determines, for the current branch, the commit hash of the last
 * build executed within Circle CI, by calling the API.
 * 
 * @returns last commit built in Circle CI on the current branch, or null
 */
export async function getLastSuccessfulBuildRevisionOnBranch(branch: string): Promise<string | null> {
  try {
    // given the build URL, which is of the form https://circleci.com/api/v2/project/{project_slug}/{build_number}
    // we can extract the project slug to call the API
    const buildUrl = requireEnv("CIRCLE_BUILD_URL")
    const projectSlug: string | undefined = /circleci\.com\/(.*\/.*\/.*)\//.exec(buildUrl)?.[1]

    if (projectSlug) {
      // Call the API for pipelines, which tell us nothing about whether all the workflows within them were
      // successful or not
      const { data: pipelineData } = await axios.get(`${CIRCLE_API_URL}/project/${projectSlug}/pipeline`, {
        params: {
          branch,
        },
      })

      // For each pipeline, fetch the workflows and find the first one where all the workflows have a
      // 'success' status
      const lastSuccessfulBuild = await find((pipelineData as CirclePipelines).items, async item => {
        if (item.state === CirclePipelineState.Created) {
          const { data: workflowData } = await axios.get(`${CIRCLE_API_URL}/pipeline/${item.id}/workflow`)

          return (workflowData as CircleWorkflows).items.every(item => item.status === CircleWorkflowStatus.Success)
        }

        return false
      })

      return lastSuccessfulBuild?.vcs.revision ?? null
    }
  } catch (e) {

  }

  return null
}