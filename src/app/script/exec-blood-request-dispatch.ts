import { BloodGroup } from '../model/blood-group';
import { BloodRequestDispatch } from '../model/blood-request-dispatch';
import { RhesusFactor } from '../model/rhesus-factor';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { Container } from './../../container';
import { withRedis } from './with-redis';

/**
 *
 *  Prefer commands over script because script is prooving tedious - Redis should not be en entanglement point
 *
 */
export const execBloodRequestDispatch = async ({
    rhesusFactor, bloodGroup, longitude, latitude, userId, requestId, dispatchId, container
}: BloodRequestDispatchProps): Promise<BloodRequestDispatch> => {
    const RHESUS_FACTOR = `donors:blood:rhesus:${rhesusFactor}`;
    const BLOOD_GROUP = `donors:blood:group:${bloodGroup}`;
    const BLOOD_COORDINATES = 'donors:blood:coordinates';
    const NEIGHBOURHOOD = `neighbourhood:${dispatchId}`;

    const [redis] = await container.inject(REDIS_TOKEN);
    let dispatch: BloodRequestDispatch;

    switch (bloodGroup) {
        case BloodGroup.O:
            const DISPATCH_O_RHESUS = `tmp:dispatch-matches:blood:${dispatchId}:${bloodGroup}:${rhesusFactor}`;
            const DISPATCH_O = `tmp:dispatch-matches:blood:${dispatchId}:${bloodGroup}`;
            const REQUEST_O_RHESUS = `request-matches:blood:${requestId}:${bloodGroup}:${rhesusFactor}`;
            const REQUEST_O = `request-matches:blood:${requestId}:${bloodGroup}`;

            await redis.send_command('GEORADIUS', BLOOD_COORDINATES, longitude, latitude, 50_000, 'm', 'ASC', 'STOREDIST', NEIGHBOURHOOD);
            await redis.zinterstore(DISPATCH_O_RHESUS, 3, NEIGHBOURHOOD, BLOOD_GROUP, RHESUS_FACTOR);
            await withRedis(redis).ZDIFFSTORE(DISPATCH_O_RHESUS, DISPATCH_O_RHESUS, REQUEST_O_RHESUS, REQUEST_O);
            await redis.zrem(DISPATCH_O_RHESUS, userId);
            // TODO: Maybe cap DISPATCH_O_RHESUS !???
            await redis.send_command('ZUNIONSTORE', REQUEST_O_RHESUS, 2, REQUEST_O_RHESUS, DISPATCH_O_RHESUS);

            const countBefore = await Promise.all([redis.zcard(REQUEST_O_RHESUS), redis.zcard(REQUEST_O)]).then(([a, b]) => +a + b);

            if (countBefore < 50) {
                await redis.zinterstore(DISPATCH_O, 2, NEIGHBOURHOOD, BLOOD_GROUP);
                await withRedis(redis).ZDIFFSTORE(DISPATCH_O, DISPATCH_O, REQUEST_O_RHESUS, REQUEST_O); // HAHAHA
                await redis.zrem(DISPATCH_O, userId);
                await redis.send_command('ZUNIONSTORE', REQUEST_O, 2, REQUEST_O, DISPATCH_O);
            }

            dispatch = await Promise.all([
                redis.zrange(DISPATCH_O_RHESUS, 0, -1, 'WITHSCORES').then(matchesCollector),
                redis.zrange(DISPATCH_O, 0, -1, 'WITHSCORES').then(matchesCollector),
            ]).then<BloodRequestDispatch>(([oRhesus, o]) => ({
                requestId,
                id: dispatchId,
                createdAt: Date.now(),
                outcome: {
                    O: {
                        [rhesusFactor]: oRhesus,
                        '*': o
                    },
                },
            }));
            await redis.del(DISPATCH_O_RHESUS, DISPATCH_O, NEIGHBOURHOOD);
            break;
        default:
            throw new Error('not implemented error');
    }

    for (const bloodGroup in dispatch.outcome) {
        for (const key in (dispatch.outcome as any)[bloodGroup]) {
            if (0 === Object.keys((dispatch.outcome as any)[bloodGroup][key]).length) {
                delete (dispatch.outcome as any)[bloodGroup][key];
            }
        }

        if (0 === Object.keys((dispatch.outcome as any)[bloodGroup]).length) {
            delete (dispatch.outcome as any)[bloodGroup];
        }
    }

    if (0 === Object.keys(dispatch.outcome!).length) {
        delete dispatch.outcome;
    }

    return dispatch;
};

export interface BloodRequestDispatchProps {
    rhesusFactor: RhesusFactor;
    bloodGroup: BloodGroup;
    container: Container;
    dispatchId: string;
    requestId: string;
    longitude: number;
    latitude: number;
    userId: string;
}

function matchesCollector(matches: string[]) {
    return matches.reduce<Record<string, number>>((hay, matchOrDistiance, index) =>
        0 === index % 2 ? hay : {
            ...hay,
            [matches[index - 1] as string]: +matchOrDistiance,
        }, {});
}
