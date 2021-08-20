import { Container } from "../container";
import packAge from '../../package.json';

export const SERVER_PORT: Token<number> = Symbol('Server port');
export const SERVER_HOST: Token<string> = Symbol('Server host');

export const APPLICATION_NAME: Token<string> = Symbol('Application name');

const {
    HOST = '0.0.0.0',
    PORT = 3000,
} = process.env;

export const createEnv = (container: Container) => {
    container.register(APPLICATION_NAME, () => packAge.name);
    container.register(SERVER_PORT, () => +PORT);
    container.register(SERVER_HOST, () => HOST);
};
