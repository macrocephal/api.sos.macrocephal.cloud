import IORedis from "ioredis";
import { Container } from './../container';
import { REDIS_DB, REDIS_ENABLE_READY_CHECK, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_STRING_NUMBERS, REDIS_COMMAND_TIMEOUT } from './create-env';

export const REDIS_TOKEN: Token<IORedis.Redis> = Symbol('Redis token');

export const createRedis: Container.Visitor = container =>
    container.register(REDIS_TOKEN, async () => {
        const [enableReadyCheck, commandTimeout, stringNumbers, password, host, port, db] = await container.inject(
            REDIS_ENABLE_READY_CHECK,
            REDIS_COMMAND_TIMEOUT,
            REDIS_STRING_NUMBERS,
            REDIS_PASSWORD,
            REDIS_HOST,
            REDIS_PORT,
            REDIS_DB,
        );

        return new IORedis({
            enableReadyCheck,
            commandTimeout,
            stringNumbers,
            password,
            db,
            ...host ? { host } : {},
            ...port ? { port } : {},
        }) as any;
    });
