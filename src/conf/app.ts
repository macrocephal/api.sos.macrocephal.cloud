import { createFirebaseApp } from './create-firebase-app';
import { clients } from './../app/api/clients';
import { dispatches } from './../app/api/dispatches';
import { requests } from './../app/api/requests';
import { users } from './../app/api/users';
import { ClientService } from './../app/service/client.service';
import { DispatchService } from './../app/service/dispatch.service';
import { Logger } from './../app/service/logger';
import { MatchService } from './../app/service/match.service';
import { RequestService } from './../app/service/request.service';
import { UserService } from './../app/service/user.service';
import { Container } from './../container';
import { APPLICATION_NAME, createEnv } from './create-env';
import { createMigrator } from './create-migrator';
import { createRedis } from './create-redis';
import { createServer } from './create-server';
import { createServerPlugin } from './create-server-plugin';

export const app = async (container = new Container()): Promise<Container> => {
    container.visit(createEnv, createServer, createFirebaseApp);
    const [appName] = await container.inject(APPLICATION_NAME);
    container.register(Logger, new Logger(() => appName));
    await createServerPlugin(container);
    container.visit(createRedis, createMigrator)
        .visit(dispatches, requests, clients, users)
        .register(DispatchService)
        .register(RequestService)
        .register(ClientService)
        .register(MatchService)
        .register(UserService)
    ;

    return container;
}
