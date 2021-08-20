import { Container } from "../container";
import packAge from '../../package.json';

export const SERVER_PORT: Token<number> = Symbol('Server port');
export const SERVER_HOST: Token<string> = Symbol('Server host');

export const APPLICATION_NAME: Token<string> = Symbol('Application name');
export const APPLICATION_RECYCLE_TIMEOUT: Token<number> = Symbol('Application recycle timeout');

export const REDIS_DB: Token<number> = Symbol('Redis db');
export const REDIS_PORT: Token<number> = Symbol('Redis port');
export const REDIS_HOST: Token<string> = Symbol('Redis host');
export const REDIS_PASSWORD: Token<string> = Symbol('Redis password');
export const REDIS_ENABLE_READY_CHECK: Token<boolean> = Symbol('Redis enable ready');
export const REDIS_STRING_NUMBERS: Token<boolean> = Symbol('Redis string numbers');
export const REDIS_COMMAND_TIMEOUT: Token<number> = Symbol('Redis command timeout');

const {
    REDIS_ENABLE_READY_CHECK: REDIS_ENABLE_READY_CHECK_ENV = false,
    REDIS_COMMAND_TIMEOUT: REDIS_COMMAND_TIMEOUT_ENV = 100,
    REDIS_STRING_NUMBERS: REDIS_STRING_NUMBERS_ENV = true,
    REDIS_PASSWORD: REDIS_PASSWORD_ENV = 'password',
    REDIS_HOST: REDIS_HOST_ENV = '0.0.0.0',
    REDIS_PORT: REDIS_PORT_ENV = 6379,
    REDIS_DB: REDID_DB_ENV = 0,

    RECYCLE_TIMEOUT: RECYCLE_TIMEOUT_ENV = 3 * 24 * 3600,

    HOST = '0.0.0.0',
    PORT = 3000,
} = process.env;

export const createEnv = (container: Container) => {
    container.register(REDIS_COMMAND_TIMEOUT, () => Number(REDIS_COMMAND_TIMEOUT_ENV) || 100);
    container.register(REDIS_ENABLE_READY_CHECK, () => Boolean(REDIS_ENABLE_READY_CHECK_ENV));
    container.register(REDIS_STRING_NUMBERS, () => Boolean(REDIS_STRING_NUMBERS_ENV));
    container.register(REDIS_PORT, () => Number(REDIS_PORT_ENV) || 6379);
    container.register(REDIS_PASSWORD, () => REDIS_PASSWORD_ENV);
    container.register(REDIS_HOST, () => REDIS_HOST_ENV);
    container.register(REDIS_DB, () => +REDID_DB_ENV || 0);

    container.register(APPLICATION_RECYCLE_TIMEOUT, () => Number(RECYCLE_TIMEOUT_ENV) || 3); //  3s seconds seems good for testing pusposes
    container.register(APPLICATION_NAME, () => packAge.name);

    container.register(SERVER_PORT, () => +PORT);
    container.register(SERVER_HOST, () => HOST);
};
