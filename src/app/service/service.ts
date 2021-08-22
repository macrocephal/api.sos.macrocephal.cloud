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

        await redis.hset(key, { ...model, createdAt: Date.now() } as never);

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
        const hash = await redis.hgetall(key);

        return Object.keys(hash).length ? this.unmarshall(hash) : null as never;
    }

    /**
     *
     * Implementation is PATCH capable
     *
     * @param model
     * @returns
     */
    async update(model: Partial<M> & { id: string }): Promise<M> {
        if (await this.exists(model.id)) {
            const redis = await this.redis;
            const key = this.key(model.id);

            if (+await redis.hset(key, { ...model, updatedAt: Date.now() } as never)) {
                return this.search(key);
            }
        }

        return null as never;
    }

    async recycle(idOrKey: Service.IdOrKey): Promise<boolean> {
        const key = this.isKey(idOrKey) ? idOrKey : this.key(idOrKey);

        if (await this.exists(key)) {
            const outcome = await (await (await this.redis).multi())
                .expire(key, await this.recycleTimeout)
                .hset(key, 'recycledAt', Date.now())
                .exec();

            return '[[null,"1"],[null,"1"]]' === JSON.stringify(outcome);
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
