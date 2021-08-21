import { Redis } from 'ioredis';
import { APPLICATION_RECYCLE_TIMEOUT } from './../../conf/create-env';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { Container } from './../../container';
import { Model } from './../model/model';

export abstract class Service<M extends Model> {
    constructor(protected container: Container) { }

    async create(model: M): Promise<M> {
        if (await this.exists(model.id)) {
            return null as never;
        }

        const key = this.key(model);
        const redis = await this.redis;

        await redis.hmset(key, model as never);

        return this.search(key);
    }

    async exists(idOrKey: Service.IdOrKey): Promise<boolean> {
        const key = this.isKey(idOrKey) ? idOrKey : this.key(idOrKey);
        const redis = await this.redis;

        return !!+await redis.exists(key);
    }

    async search(idOrKey: Service.IdOrKey): Promise<M> {
        const key = this.isKey(idOrKey) ? idOrKey : this.key(idOrKey);
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
        const key = this.key(model.id);
        const redis = await this.redis;

        if (await this.exists(model.id)) {
            const keyValueSeries = Object.keys(model).reduce((hay, key) => [...hay, key, (model as any)[key]], [] as any[]);

            if ('OK' === await redis.hmset(key, ...keyValueSeries)) {
                return this.search(key);
            }
        }

        return null as never;
    }

    async recycle(idOrKey: Service.IdOrKey): Promise<boolean> {
        const key = this.isKey(idOrKey) ? idOrKey : this.key(idOrKey);
        const recycleTimeout = await this.recycleTimeout;
        const redis = await this.redis;

        if (await this.exists(key)) {
            return !!+await redis.expire(key, recycleTimeout);
        }

        return false;
    }

    abstract key(idOrKeyOrModel: Partial<M> | Service.IdOrKey): Service.Key;
    abstract id(key: string): string;

    protected unmarshall(hash: Record<string, string>): M {
        const model: M = JSON.parse(JSON.stringify(hash));

        return {
        ...model,
        ...model.createdAt ? { createdAt: +model.createdAt } : {},
        ...model.updatedAt ? { updatedAt: +model.updatedAt } : {},
        ...model.recycledAt ? { createdAt: +model.recycledAt } : {},
    }
    }

    protected get recycleTimeout(): Promise<number> {
        return this.container.inject(APPLICATION_RECYCLE_TIMEOUT).then(([redis]) => redis);
    }

    protected get redis(): Promise<Redis> {
        return this.container.inject(REDIS_TOKEN).then(([redis]) => redis);
    }

    protected isKey(maybeKey: string): maybeKey is Service.Key {
        return maybeKey.includes(':');
    }
}

export namespace Service {
    export type IdOrKey = string | Key;

    export type Key = `${string}:${string}`;
}
