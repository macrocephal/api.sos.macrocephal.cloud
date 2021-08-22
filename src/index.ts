import { Logger } from './app/service/logger';
import { app } from './conf/app';
import { REDIS_TOKEN } from './conf/create-redis';
import { SERVER_TOKEN } from './conf/create-server';

(async (log?: Logger) => {
    try {
        const [logger, server, redis] = await app().inject(Logger, SERVER_TOKEN, REDIS_TOKEN);

        log = logger;
        await server.start();
        logger.log(`Started ${server.info.uri}`);
        process.on('SIGINT', () => {
            server.stop();
            redis.disconnect(false);
            logger.log(`Stopped ${server.info.uri}, closed Redis, gracefully shutdown!`);
            process.exit(130);
        });
    } catch (error) {
        (log ?? console).error(error);
    }
})();
