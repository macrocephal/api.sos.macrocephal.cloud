import { Redis } from 'ioredis';
import { APPLICATION_RECYCLE_TIMEOUT } from './../../conf/create-env';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { Container } from './../../container';
import { Model } from './../model/model';

export abstract class Service<M extends Model> {
    constructor(protected container: Container) { }

    async create(model: M): Promise<M> {
        if (await this.exists(model)) {
            return null as never;
        }

        const key = this.key(model);
        const redis = await this.redis;

        await redis.hmset(key, model as never);

        return this.search(key);
    }

    async exists(criterium: { id: string } | { key: string }): Promise<boolean> {
        const key = 'id' in criterium ? this.key(criterium) : criterium.key;
        const redis = await this.redis;

        return !!await redis.exists(key);
    }

    async search(key: string): Promise<M>;
    async search(criterium: { id: string }): Promise<M>;
    async search(keyOrCriterium: string | { id: string }): Promise<M> {
        const key = 'string' === typeof keyOrCriterium ? keyOrCriterium : this.key(keyOrCriterium);
        const redis = await this.redis;

        return this.unmarshall(await redis.hgetall(key));
    }

    /**
     *
     * Implementation is PATCH capable
     *
     * @param model
     * @returns
     */
    async update(model: Partial<M> & { id: string }): Promise<M> {
        const key = this.key(model);
        const redis = await this.redis;

        if (await this.exists({ key })) {
            const keyValueSeries = Object.keys(model).reduce((hay, key) => [...hay, key, (model as any)[key]], [] as any[]);

            if ('OK' === await redis.hmset(key, ...keyValueSeries)) {
                return this.search(key);
            }
        }

        return null as never;
    }

    async recycle(key: string): Promise<boolean>;
    async recycle(criterium: { id: string }): Promise<boolean>;
    async recycle(keyOrCriterium: string | { id: string }): Promise<boolean> {
        const key = 'string' === typeof keyOrCriterium ? keyOrCriterium : this.key(keyOrCriterium);
        const recycleTimeout = await this.recycleTimeout;
        const redis = await this.redis;

        if (await this.exists({ key })) {
            return !!await redis.expire(key, recycleTimeout);
        }

        return false;
    }

    protected abstract id(key: string): string;
    protected abstract unmarshall(hash: Record<string, string>): M;
    protected abstract key(Model: Partial<M> | { id: string }): string;

    protected get recycleTimeout(): Promise<number> {
        return this.container.inject(APPLICATION_RECYCLE_TIMEOUT).then(([redis]) => redis);
    }

    protected get redis(): Promise<Redis> {
        return this.container.inject(REDIS_TOKEN).then(([redis]) => redis);
    }
}
