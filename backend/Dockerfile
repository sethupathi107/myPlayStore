FROM node:24

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .


# Not `npm start` - that runs with `--env-file=.env`, which errors out when
# no .env file exists in the container. Hosts like Render/Railway inject
# config as real environment variables, so server.js (which reads
# process.env directly) needs no .env file at all in production.
CMD ["node", "server.js"]