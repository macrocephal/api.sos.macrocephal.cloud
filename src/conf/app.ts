import { BloodDonorService } from './../app/service/blood-donor.service';
import { bloodRequests } from '../app/api/requests/blood';
import { bloodDonors } from './../app/api/donors/blood';
import { createFirebaseApp } from './create-firebase-app';
import { Logger } from './../app/service/logger';
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
        .visit(bloodDonors, bloodRequests)
        .register(BloodDonorService)
    ;

    return container;
}
