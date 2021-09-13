import { Logger } from './app/service/logger';
import { app } from './conf/app';
import { MIGRATOR_TOKEN } from './conf/create-migrator';
import { REDIS_TOKEN } from './conf/create-redis';
import { SERVER_TOKEN } from './conf/create-server';

(async () => {
    const [logger, server, redis, migrator] = await app().then(app =>
        app.inject(Logger, SERVER_TOKEN, REDIS_TOKEN, MIGRATOR_TOKEN));

    try {
        await migrator();
        await server.start();
        logger.log(`Started ${server.info.uri}`);
        process.on('SIGINT', () => {
            server!.stop();
            redis!.disconnect(false);
            logger!.log(`Stopped ${server!.info.uri}, closed Redis, gracefully shutdown!`);
            process.exit(130);
        });
    } catch (error) {
        server?.stop();
        redis?.disconnect(false);
        (logger ?? console).error(error);
    }
})();
