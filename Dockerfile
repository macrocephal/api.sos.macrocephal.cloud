#
# {{ development }}
#
FROM node:alpine AS development
CMD [ "yarn", "start:watch"]
WORKDIR /opt/app

COPY package.json yarn.loc[k] ./
RUN yarn install
COPY . .

#
# {{ test }}
#
FROM development AS test
ARG REDIS_DB 15
RUN yarn test

#
# {{ build }}
#
FROM development AS build
RUN yarn build --mode production

#
# {{ production }}
#
FROM node:alpine AS production
CMD [ "node", "--enable-source-maps", "--trace-warnings", "index.js" ]
ENV NODE_ENV production
WORKDIR /opt/app

COPY package.json yarn.loc[k] ./
RUN yarn install

COPY --from=build /opt/app/dist/index.js* ./
