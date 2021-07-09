# Changelog

- 2021/07/09 - 3.0.0

  - Grab `dependencies` from each package's `circle.yml` file instead of configuring all dependencies in `.circleci/circletron.yml`.
  - Fix bug where branchpoint could be detected earlier than it actually was.

- 2021/07/05 - 2.0.1

  - Use `targetBranches` regex to determine when to run all jobs on a branch.

- 2021/06/25 - 2.0.0

  - Use `.circleci/circletron.yml` as the configuration file instead of `.circleci/lerna.yml`.
