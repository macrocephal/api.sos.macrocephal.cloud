import { SERVER_HOST, SERVER_PORT } from './create-env';
import { Container } from './../container';
import { Server } from "@hapi/hapi";

export const SERVER_TOKEN: Token<Server> = Symbol('Server token');

export const createServer = (container: Container) =>
    container.register(SERVER_TOKEN, async () => new Server({
        host: (await container.inject(SERVER_HOST))[0],
        port: (await container.inject(SERVER_PORT))[0],
    }));
