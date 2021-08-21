import { clients } from './app/api/clients';
import { dispatches } from './app/api/dispatches';
import { matches } from './app/api/matches';
import { requests } from './app/api/requests';
import { users } from './app/api/users';
import { ClientService } from './app/service/client.service';
import { DispatchService } from './app/service/dispatch.service';
import { Logger } from './app/service/logger';
import { MatchService } from './app/service/match.service';
import { RequestService } from './app/service/request.service';
import { UserService } from './app/service/user.service';
import { createEnv } from './conf/create-env';
import { createRedis, REDIS_TOKEN } from './conf/create-redis';
import { createServer, SERVER_TOKEN } from './conf/create-server';
import { createServerPlugin } from './conf/create-server-plugin';
import { Container } from './container';

(async container => {
    try {
        process.on('SIGINT', () => {
            server.stop();
            redis.disconnect(false);
            logger.log(`Stopped ${server.info.uri}, closed Redis, gracefully shutdown!`);
            process.exit(130);
        });
        container.visit(createEnv, createRedis, createServer, createServerPlugin)
            .visit(dispatches, requests, matches, clients, users)
            .register(DispatchService)
            .register(RequestService)
            .register(ClientService)
            .register(MatchService)
            .register(UserService)
            .register(Logger);

        const [logger, server, redis] = await container.inject(Logger, SERVER_TOKEN, REDIS_TOKEN);

        await server.start();
        logger.log(`Started ${server.info.uri}`);
    } catch (error) {
        (await container.inject(Logger))[0].error(error);
    }
})(new Container());
