import { ClientService } from './../service/client.service';
import { APPLICATION_MATCH_LIMIT } from '../../conf/create-env';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { Container } from './../../container';
import { Kind } from './../model/kind';

export const execMatch = async ({ container, requestKind, dispatchId, clientId, radius }: MatchProps) => {
    const [redis, count, clientService] = await container
        .inject(REDIS_TOKEN, APPLICATION_MATCH_LIMIT, ClientService);
    const { userId } = await clientService.search(clientId);
    const unit = radius.split(/^\d+(\.\d+)?/)[2]!;
    const length = +radius.split(unit)[0]!;

    await redis.eval(
        `-- Of all the clients in the vicinity
        redis.call('GEORADIUSBYMEMBER', KEYS[1], ARGV[1], ARGV[2], ARGV[3], 'ASC', 'STOREDIST', 'tmp:match:vicinity-clients');

        -- Map clientIds to userIds set
        for _, clientId in ipairs( redis.call('ZRANGEBYSCORE', 'tmp:match:vicinity-clients', '-inf', '+inf') ) do
            for _, userId in ipairs( redis.call('SMEMBERS', 'mapping:client-users:' .. clientId) ) do
                redis.call('ZADD', 'tmp:match:vicinity-users', 0, userId);
            end
        end

        -- Intersect users with their candidacies
        redis.call('ZINTERSTORE', KEYS[2], 2, KEYS[3], 'tmp:match:vicinity-users', 'WEIGHTS', 0, 1);

        -- Remove self
        redis.call('ZREM', KEYS[2], ARGV[4]);

        -- Prune
        redis.call('ZREMRANGEBYRANK', KEYS[2], ARGV[5], 1000000000);

        -- Clean up
        redis.call('DEL', 'tmp:match:vicinity-users', 'tmp:match:vicinity-clients');`,
        3, 'data:positions', `data:match:${dispatchId}`, `data:candidacies:${requestKind}`,
        clientId, length, unit, userId, count);
};

export interface MatchProps {
    container: Container;
    dispatchId: string;
    requestKind: Kind;
    clientId: string;
    radius: string;
    // userId: string;
    // count: number;
    // redis: Redis;
}
