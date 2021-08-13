from node:16-alpine3.13 as builder

workdir /home/circletron/app
copy package.json package-lock.json ./
run npm install
copy src ./src
run npm run build

from node:16-alpine3.13
run apk add git openssh-client && npm install -g lerna
copy --from=builder /home/circletron/app /home/circletron/app
run \
  ln -s /home/circletron/app /usr/local/lib/node_modules/circletron && \
  ln -s /home/circletron/app/dist/index.js /usr/local/bin/circletron && \
  chmod a+x /usr/local/bin/circletron
