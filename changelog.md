# Changelog

- 2021/02/03 - 3.0.5

  - Fix bug that occurs when jobs with parameters are skipped.

- 2021/10/22 - 3.0.4

  - Add `passTargetBranch` configuration option.

- 2021/09/06 - 3.0.3

  - Add `runOnlyChangedOnTargetBranches` configuraton option.

- 2021/08/13 - 3.0.2

  - Fix crash for circle.yml files without `jobs`.

- 2021/08/03 - 3.0.1

  - Fix support for `dependencies`.

- 2021/07/09 - 3.0.0

  - Grab `dependencies` from each package's `circle.yml` file instead of configuring all dependencies in `.circleci/circletron.yml`.
  - Fix bug where branchpoint could be detected earlier than it actually was.

- 2021/07/05 - 2.0.1

  - Use `targetBranches` regex to determine when to run all jobs on a branch.

- 2021/06/25 - 2.0.0

  - Use `.circleci/circletron.yml` as the configuration file instead of `.circleci/lerna.yml`.
