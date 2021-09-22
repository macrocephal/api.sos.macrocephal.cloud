import { app } from 'firebase-admin';
import { Redis } from 'ioredis';
import { FIREBASE_APP_TOKEN } from './../conf/create-firebase-app';
import { REDIS_TOKEN } from './../conf/create-redis';
import { Container } from './../container';
import { Logger } from './service/logger';

export class WithApplication extends Container.WithContainer {
    protected readonly firebase!: app.App;
    protected readonly logger!: Logger;
    protected readonly redis!: Redis;

    protected constructor(container: Container) {
        super(container);
        (async () => {
            // @ts-ignore Cannot assign to 'XXX' because it is a read-only property.
            [this.logger, this.redis, this.firebase] = await container
                .inject(Logger, REDIS_TOKEN, FIREBASE_APP_TOKEN);
        })();
    }
}