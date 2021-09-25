import { app } from 'firebase-admin';
import { Redis } from 'ioredis';
import { FIREBASE_APP_TOKEN } from './../conf/create-firebase-app';
import { REDIS_TOKEN } from './../conf/create-redis';
import { Container } from './../container';
import { BloodGroup } from './model/blood-group';
import { RhesusFactor } from './model/rhesus-factor';
import { Logger } from './service/logger';

export class WithApplication extends Container.WithContainer {
    static readonly ERROR_NOT_FOUND = 'ERROR_NOT_FOUND';
    static readonly ERROR_CONFLICT = 'ERROR_CONFLICT';

    #key = {
        donors: {
            blood: {
                coordinates: (): string => 'donors:blood:coordinates',
                group: (bloodGroup: BloodGroup): string => `donors:blood:group:${bloodGroup}`,
                rhesus: (rhesusFactor: RhesusFactor): string => `donors:blood:rhesus:${rhesusFactor}`,
                request: (requestId: string, bloodGroup: BloodGroup, rhesusFactor?: RhesusFactor): string =>
                    `tmp:request-matches:blood:${requestId}:${bloodGroup}${rhesusFactor ? `:${rhesusFactor}` : ''}`,
                dispatch: (dispatchId: string, bloodGroup: BloodGroup, rhesusFactor?: RhesusFactor): string =>
                    `tmp:dispatch-matches:blood:${dispatchId}:${bloodGroup}${rhesusFactor ? `:${rhesusFactor}` : ''}`,
            },
        },
        of: {
            neighbourhood: (dispatchId: string): string => `tmp:neigbourhood:${dispatchId}`,
        },
    } as const;

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

    get key() {
        return this.#key;
    }
}
