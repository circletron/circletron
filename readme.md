# circletron

Circletron is a tool to simplify working with monorepos. Currently monorepos managed via lerna are supported.

It allows splitting up `.circle/config.yml` among subprojects in the monorepo such that each subproject can define its own commands, workflows and jobs. These jobs can then be automatically skipped when not required.

## How to use

1. Create a minimal `.config/circle.yml` like this:

```yaml
version: 2.1
setup: true
orbs:
  circletron: circletron/circletron@1.0.1

workflows:
  trigger-jobs:
    jobs:
      - circletron/trigger-jobs
```

2. You may create a `circle.yml` in the root of your monorepo. The jobs in this `circle.yml` will always run and any `commands`, `executors` and `orbs` defined in this `circle.yml` will be available in the `circle.yml` of all other subpackages.

3. Create a `circle.yml` in each subpackage within the monorepo which requires automatiion. The jobs in this circle configuration are run only when there are changes in the respective branch to a file within this subpackage or changes to a file in one of its dependents. `conditional: false` may be added to a job to specify that it must always run even when no changes to the subpackage or one of its dependencies is detected.

4. Optionally create a `.circle/lerna.yml` file to specify dependencies within projects, e.g.

```
dependencies:
  project1:
    - project2
    - project3
```

will cause jobs within `project1` to run when changes are detected in either `project1`, `project2` or `project3`.

## Details

It is useful to set up branch protection rules to prevent code from being merged when a CI job does not pass. When jobs are omitted then the PR will never be mergeable since the job will remain in a `pending` state. For this reason `circletron` will never omit a job that was determined not to be run, instead the job will be replaced wit a simple job that echos "Job is not required" and return a success exit status.

For the following branches all jobs will run:

- main
- master
- develop
- branches starting with `release/`

This will be configurable in a future release.
