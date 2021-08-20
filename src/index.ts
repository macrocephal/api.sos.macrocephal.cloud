import { clients } from './app/api/clients';
import { dispatches } from './app/api/dispatches';
import { matches } from './app/api/matches';
import { requests } from './app/api/requests';
import { users } from './app/api/users';
import { Logger } from './app/service/logger';
import { createEnv } from './conf/create-env';
import { createRedis, REDIS_TOKEN } from './conf/create-redis';
import { createServer, SERVER_TOKEN } from './conf/create-server';
import { Container } from './container';

(async container => {
    try {
        const [logger, server, redis] = await container
            // configration visitors
            .visit(createEnv, createRedis, createServer)
            // endpoint visitors
            .visit(
                dispatches,
                requests,
                matches,
                clients,
                users,
            )
            // services
            .register(Logger)
            .inject(Logger, SERVER_TOKEN, REDIS_TOKEN);

        await server.start();
        process.on('SIGINT', () => {
            server.stop();
            logger.log(`Stopped from ${server.info.uri}`);
            redis.disconnect(false);
            logger.log(`Disconnected from Redis`);
            logger.log(`Gracefully shutdown!`);
        });
        logger.log(`Started on ${server.info.uri}`);
    } catch (error) {
        (await container.inject(Logger))[0].error(error);
    }
})(new Container());
