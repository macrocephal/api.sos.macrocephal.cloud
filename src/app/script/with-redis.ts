import { Redis } from "ioredis";

export const withRedis = (redis: Redis): withRedis.WithRedis => ({
    async ZDIFFSTORE(destination, keyCount, ...keys) {
        switch (keyCount) {
            case 0:
            case 1:
                await redis.zunionstore(destination, keyCount, ...keys);
                return redis.zcard(destination);
            default:
                await redis.eval(
                    `redis.call('ZUNIONSTORE', 'tmp', 1, KEYS[2]);

                    for i=3,tonumber(ARGV[1]) do
                        for _,member in ipairs( redis.call('ZRANGE', KEYS[i], 0, -1) ) do
                            if nil == redis.call('ZRANK', tmp, member) then
                                redis.call('ZREM', 'tmp', member);
                            end
                        end
                    end

                    redis.call('ZUNIONSTORE', KEYS[1], 1, 'tmp');
                    redis.call('DEL', 'tmp');

                    return redis.call('ZCARD', KEYS[1]);`, keys.length + 1, destination, ...keys,
                    keyCount);
                return 1;
        }
    }
});

export namespace withRedis {
    export interface WithRedis {
        ZDIFFSTORE<N extends number>(destination: string, keyCount: N, ...keys: string[] & { length: N }): Promise<number>;
    }
}
