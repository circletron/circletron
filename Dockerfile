from node:16-alpine3.13 as builder

workdir /home/circletron/app
copy package.json package-lock.json ./
copy src ./src
run npm install
run npm run build

from node:16-alpine3.13
copy bin/get-branchpoint-commit.sh /usr/local/bin/
copy --from=builder /home/circletron/app /home/circletron/app
run \
  apk add git openssh-client && \
  npm install -g lerna && \
  ln -s /home/circletron/app /usr/local/lib/node_modules/circletron && \
  ln -s /home/circletron/app/dist/index.js /usr/local/bin/circletron && \
  chmod a+x /usr/local/bin/circletron
