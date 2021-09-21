import { BloodGroup } from '../model/blood-group';
import { RhesusFactor } from '../model/rhesus-factor';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { Container } from './../../container';
import { BloodDispatch } from './../model/blood-dispatch';
import { Logger } from './../service/logger';
import { withRedis } from './with-redis';

/**
 *
 *  Prefer commands over script because script is prooving tedious - Redis should not be en entanglement point
 *
 */
export const execBloodRequestDispatch = async ({
    rhesusFactor, bloodGroup, longitude, latitude, userId, requestId, dispatchId, container
}: BloodRequestDispatchProps): Promise<BloodDispatch> => {
    const RHESUS_FACTOR = `donors:blood:rhesus:${rhesusFactor}`;
    const BLOOD_GROUP = `donors:blood:group:${bloodGroup}`;
    const BLOOD_COORDINATES = 'donors:blood:coordinates';
    const NEIGHBOURHOOD = `neighbourhood:${dispatchId}`;

    const [redis, logger] = await container.inject(REDIS_TOKEN, Logger);
    let dispatch: BloodDispatch;

    switch (bloodGroup) {
        case BloodGroup.O:
            const DISPATCH_O_RHESUS = `tmp:dispatch-matches:blood:${dispatchId}:${bloodGroup}:${rhesusFactor}`;
            const DISPATCH_O = `tmp:dispatch-matches:blood:${dispatchId}:${bloodGroup}`;
            const REQUEST_O_RHESUS = `request-matches:blood:${requestId}:${bloodGroup}:${rhesusFactor}`;
            const REQUEST_O = `request-matches:blood:${requestId}:${bloodGroup}`;

            await logger.trace(`${BLOOD_COORDINATES} >>>`, await redis.zrange(BLOOD_COORDINATES, 0, -1, 'WITHSCORES'));
            await redis.send_command('GEORADIUS', BLOOD_COORDINATES, longitude, latitude, 50_000, 'm', 'ASC', 'STOREDIST', NEIGHBOURHOOD);
            await logger.trace(`${NEIGHBOURHOOD} >>>`, await redis.zrange(NEIGHBOURHOOD, 0, -1, 'WITHSCORES'));
            // {DISPATCH} Find all group O<rhesus> in the neighbourhood
            await redis.zinterstore(DISPATCH_O_RHESUS, 3, NEIGHBOURHOOD, BLOOD_GROUP, RHESUS_FACTOR);
            // {DISPATCH} Retain distinct matches between this dispatch and overall request matches
            await logger.trace(`${DISPATCH_O_RHESUS} >>>`, await redis.zrange(DISPATCH_O_RHESUS, 0, -1, 'WITHSCORES'));
            await withRedis(redis).ZDIFFSTORE(DISPATCH_O_RHESUS, DISPATCH_O_RHESUS, REQUEST_O_RHESUS, REQUEST_O);
            // {DISPATCH} Remove requester, if the latter happens to be a matching donor as well
            await redis.zrem(DISPATCH_O_RHESUS, userId);
            await logger.trace(`${DISPATCH_O_RHESUS} >>>`, await redis.zrange(DISPATCH_O_RHESUS, 0, -1, 'WITHSCORES'));

            // TODO: Maybe cap DISPATCH_O_RHESUS !???
            // {REQUEST} Merge this dispatch matches with request's
            await redis.send_command('ZUNIONSTORE', REQUEST_O_RHESUS, 2, REQUEST_O_RHESUS, DISPATCH_O_RHESUS);
            await logger.trace(`${REQUEST_O_RHESUS} >>>`, await redis.zrange(REQUEST_O_RHESUS, 0, -1, 'WITHSCORES'));

            const countBefore = await Promise.all([redis.zcard(REQUEST_O_RHESUS), redis.zcard(REQUEST_O)]).then(([a, b]) => +a + b);

            if (countBefore < 50) {
                // {DISPATCH} Find all group O in the neighbourhood
                await redis.zinterstore(DISPATCH_O, 2, NEIGHBOURHOOD, BLOOD_GROUP);
                await logger.trace(`${DISPATCH_O} >>>`, await redis.zrange(DISPATCH_O, 0, -1, 'WITHSCORES'));
                // {DISPATCH} Retain distinct matches between this dispatch and overall request matches
                await withRedis(redis).ZDIFFSTORE(DISPATCH_O, DISPATCH_O, REQUEST_O_RHESUS, REQUEST_O); // HAHAHA
                await logger.trace(`${DISPATCH_O} >>>`, await redis.zrange(DISPATCH_O, 0, -1, 'WITHSCORES'));
                // {DISPATCH} Remove requester, if the latter happens to be a matching donor as well
                await redis.zrem(DISPATCH_O, userId);
                await logger.trace(`${DISPATCH_O} >>>`, await redis.zrange(DISPATCH_O, 0, -1, 'WITHSCORES'));
                // {REQUEST} Merge this dispatch matches with request's
                await redis.send_command('ZUNIONSTORE', REQUEST_O, 2, REQUEST_O, DISPATCH_O);
                await logger.trace(`${REQUEST_O} >>>`, await redis.zrange(REQUEST_O, 0, -1, 'WITHSCORES'));
                // TODO: Maybe cap DISPATCH_O !???
            }

            dispatch = await Promise.all([
                redis.zrange(DISPATCH_O_RHESUS, 0, -1, 'WITHSCORES').then(matchesCollector),
                redis.zrange(DISPATCH_O, 0, -1, 'WITHSCORES').then(matchesCollector),
            ]).then<BloodDispatch>(([oRhesus, o]) => ({
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
        dispatch.outcome = null;
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
