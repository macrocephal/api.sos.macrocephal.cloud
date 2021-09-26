import { bloodRequests } from '../app/api/requests/blood';
import { bloodDonors } from './../app/api/donors/blood';
import { BloodDonorService } from './../app/service/blood-donor.service';
import { BloodRequestService } from './../app/service/blood-request.service';
import { Logger } from './../app/service/logger';
import { Container } from './../container';
import { APPLICATION_NAME, createEnv } from './create-env';
import { createFirebaseApp } from './create-firebase-app';
import { createMigrator } from './create-migrator';
import { createRedis } from './create-redis';
import { createServer } from './create-server';
import { createServerPlugin } from './create-server-plugin';

export const app = async (container = new Container()): Promise<Container> => {
    container.visit(createEnv, createServer, createFirebaseApp);
    const [appName] = await container.inject(APPLICATION_NAME);
    container.register(Logger, new Logger(() => appName));
    container.visit(createRedis, createMigrator)
        .register(BloodRequestService)
        .register(BloodDonorService)
        ;
    await createServerPlugin(container);
    await container.visit(bloodDonors, bloodRequests)

    return container;
}
