import { users } from './app/api/users';
import { clients } from './app/api/clients';
import { matches } from './app/api/matches';
import { dispatches } from './app/api/dispatches';
import { requests } from './app/api/requests';
import { Logger } from './app/service/logger';
import { createEnv } from './conf/create-env';
import { createServer, SERVER_TOKEN } from './conf/create-server';
import { Container } from './container';

(async container => {
    const [logger, server] = await container
        // configration visitors
        .visit(createServer, createEnv)
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
        .inject(Logger, SERVER_TOKEN);

    await server.start();
    process.on('SIGINT', () => {
        server.stop();
        logger.log(`Stopped from ${server.info.uri}`);
        logger.log(`Gracefully shutdown!`);
    });
    logger.log(`Started on ${server.info.uri}`);
})(new Container()).catch(error => new Logger(new Container()).error(error));
