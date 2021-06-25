#!/usr/bin/env sh

# look for the most recent commit that belongs to the branch "develop" or a release branch
for commit in $(git log --pretty=format:%h) ; do
  if git branch --contains $commit --format='%(refname:short)' \
    | grep -qE '^(release/|develop$|main$|master$)'
  then
    echo $commit
    exit 0
  fi
done

echo > /dev/stderr failed to find parent branch
exit 1
