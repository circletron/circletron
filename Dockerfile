from circleci/node:14 as builder

user root
workdir /home/circleci/circletron
copy package.json package-lock.json ./
copy src ./src
run npm install
run npm run build

from circleci/node:14
add bin/get-branchpoint-commit.sh /usr/local/bin/get-branchpoint-commit.sh
run sudo npm install -g lerna
copy --from=builder /home/circleci/circletron /home/circleci/circletron
run sudo ln -s /home/circleci/circletron /usr/local/lib/node_modules/circletron
run sudo ln -s /home/circleci/circletron/dist/index.js /usr/local/bin/circletron
run sudo chmod a+x /usr/local/bin/circletron
