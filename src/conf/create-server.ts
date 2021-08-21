import { SERVER_HOST, SERVER_PORT } from './create-env';
import { Container } from './../container';
import { Server } from "@hapi/hapi";
import { ValidationError } from 'joi';

export const SERVER_TOKEN: Token<Server> = Symbol('Server token');

export const createServer = (container: Container) =>
    container.register(SERVER_TOKEN, async () => new Server({
        host: (await container.inject(SERVER_HOST))[0],
        port: (await container.inject(SERVER_PORT))[0],
        routes: {
            validate: {
                async failAction(_request, h, error) {
                    if (error instanceof ValidationError) {
                        return h.response(error.details).code(400).takeover();
                    }

                    throw error;
                }
            }
        },
    }));
