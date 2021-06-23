#!/usr/bin/env bash

# look for the most recent commit that belongs to the branch "develop" or a release branch
for commit in $(git log --pretty=format:%h) ; do
  # the --format option to `git branch` is not available in all of the circleci containers
  # currently being used so sed is used to remove the current branch indicator
  branches=$(git branch --contains $commit | sed 's/^\*//')
  if echo $branches | grep -qE '\b(release/|develop$|main$|master$)' ; then
    echo $commit
    exit 0
  fi
done

echo > /dev/stderr failed to find parent branch
exit 1
