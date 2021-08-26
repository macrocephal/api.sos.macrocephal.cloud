import { clients } from './../app/api/clients';
import { dispatches } from './../app/api/dispatches';
import { matches } from './../app/api/matches';
import { requests } from './../app/api/requests';
import { users } from './../app/api/users';
import { ClientService } from './../app/service/client.service';
import { DispatchService } from './../app/service/dispatch.service';
import { Logger } from './../app/service/logger';
import { MatchService } from './../app/service/match.service';
import { RequestService } from './../app/service/request.service';
import { UserService } from './../app/service/user.service';
import { Container } from './../container';
import { createEnv } from './create-env';
import { createRedis } from './create-redis';
import { createServer } from './create-server';
import { createServerPlugin } from './create-server-plugin';

export const app = (container = new Container()): Container =>
    container
        .visit(createEnv, createRedis, createServer, createServerPlugin)
        .visit(dispatches, requests, matches, clients, users)
        .register(DispatchService)
        .register(RequestService)
        .register(ClientService)
        .register(MatchService)
        .register(UserService)
        .register(Logger, new Logger(() => container.inject(APPLICATION_NAME).then(([ns]) => ns)))
    ;
