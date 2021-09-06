import axios from 'axios'

import { requireEnv } from './env'

const CIRCLE_API_URL = 'https://circleci.com/api/v2'

interface CirclePipelineError {
  type: string
  message: string
}

interface CirclePipelineVCSInfo {
  provider_name: 'GitHub' | 'Bitbucket'
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
  id: string
  errors: CirclePipelineError[]
  state: CirclePipelineState
  vcs: CirclePipelineVCSInfo
}

interface CirclePipelines {
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
  id: string
  status: CircleWorkflowStatus
}

interface CircleWorkflows {
  items: CircleWorkflowItem[]
}

async function find<I>(
  items: I[],
  asyncCallback: (input: I) => Promise<boolean>,
): Promise<I | null> {
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
 * @returns last commit built in Circle CI on the current branch, or undefined
 */
export async function getLastSuccessfulBuildRevisionOnBranch(
  branch: string,
): Promise<string | undefined> {
  try {
    // given the build URL, which is of the form https://circleci.com/{project_slug}/{build_number}
    // we can extract the project slug to call the API
    const buildUrl = requireEnv('CIRCLE_BUILD_URL')
    const projectSlug: string | undefined = /circleci\.com\/(.*\/.*\/.*)\//.exec(buildUrl)?.[1]

    // to access the API, we require the user to specify an access token that we provide in the
    // 'Circle-Token' header
    const circleToken = requireEnv('CIRCLE_TOKEN')
    const headers = {
      'Circle-Token': circleToken,
    }

    if (projectSlug) {
      // Call the API for pipelines, which tell us nothing about whether all the workflows within them were
      // successful or not
      const { data: pipelineData } = await axios.get(
        `${CIRCLE_API_URL}/project/${projectSlug}/pipeline`,
        {
          headers,
          params: {
            branch,
          },
        },
      )

      // For each pipeline, fetch the workflows and find the first one where all the workflows have a
      // 'success' or 'on hold' status. We assume that 'on hold' pipelines would have succeeded were
      // they to be approved
      const lastSuccessfulBuild = await find(
        (pipelineData as CirclePipelines).items,
        async (item) => {
          if (item.state === CirclePipelineState.Created) {
            const { data: workflowData } = await axios.get(
              `${CIRCLE_API_URL}/pipeline/${item.id}/workflow`,
              { headers },
            )

            return (workflowData as CircleWorkflows).items.every((item) =>
              [CircleWorkflowStatus.Success, CircleWorkflowStatus.OnHold].includes(item.status),
            )
          }

          return false
        },
      )

      return lastSuccessfulBuild?.vcs.revision
    }
  } catch (e) {
    console.log(`Failed to call Circle API v2 with error: ${e.message}`)
  }
}
