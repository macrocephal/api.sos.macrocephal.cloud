import { REDIS_TOKEN } from '../../conf/create-redis';
import { Container } from '../../container';

export const execMatchOutcome = async ({ container, dispatchId }: MatchOutcome) => {
    const [redis] = await container.inject(REDIS_TOKEN);

    return +await redis.eval(
        `if 1 == redis.call('EXISTS', KEYS[1]) then
            return redis.call('ZCARD', KEYS[1]);
        end

        return -1;`,
        1, `data:match:${dispatchId}`);
};

export interface MatchOutcome {
    container: Container;
    dispatchId: string;
}
