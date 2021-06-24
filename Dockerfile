from circleci/node:16 as builder

user root
workdir /home/circleci/circletron
copy package.json package-lock.json ./
copy src ./src
run npm install
run npm run build

from circleci/node:16
copy bin/get-branchpoint-commit.sh /usr/local/bin/
copy --from=builder /home/circleci/circletron /home/circleci/circletron
run \
  sudo npm install -g lerna && \
  sudo ln -s /home/circleci/circletron /usr/local/lib/node_modules/circletron && \
  sudo ln -s /home/circleci/circletron/dist/index.js /usr/local/bin/circletron && \
  sudo chmod a+x /usr/local/bin/circletron
