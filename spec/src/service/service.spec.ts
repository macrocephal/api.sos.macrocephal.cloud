import IORedis from 'ioredis';
import { Service } from '../../../src/app/service/service';
import { Model } from '../../../src/app/model/model';
import { APPLICATION_RECYCLE_TIMEOUT, createEnv } from '../../../src/conf/create-env';
import { createRedis, REDIS_TOKEN } from '../../../src/conf/create-redis';
import { Container } from '../../../src/container';

describe('Service', () => {
    beforeEach(async () => {
        class TestService extends Service<TestUser> {
            key(idOrKeyOrModel: Service.IdOrKey | Partial<TestUser>): Service.Key {
                if ('string' === typeof idOrKeyOrModel) {
                    return this.isKey(idOrKeyOrModel) ? idOrKeyOrModel : `test:${idOrKeyOrModel}`;
                }

                return this.key(idOrKeyOrModel.id!);
            }

            protected override unmarshall(hash: Record<string, string>): TestUser {
                const model: TestUser = super.unmarshall(hash);

                return {
                    ...model,
                    ...model.age ? { age: +model.age } : {},
                };
            }

            id(key: string): string {
                return key.split(':')[1]!;
            }

        }

        before = {
            age: Math.random(),
            id: Math.random().toString(36),
            email: `${Math.random().toString(36).replace('.', '@')}.tld`,
        };
        recycleTimeout = 1 + Math.round(2 * Math.random());
        container = new Container()
            .register(TestService)
            .visit(createEnv, createRedis)
            .register(APPLICATION_RECYCLE_TIMEOUT, () => recycleTimeout);
        ([redis, service] = await container.inject(REDIS_TOKEN, TestService));
        await redis.flushdb();
    });

    afterEach(() => redis.flushdb());

    type TestUser = Model & { email: string, age: number };
    let service: Service<TestUser>;
    let recycleTimeout: number;
    let container: Container;
    let redis: IORedis.Redis;
    let before: TestUser;

    describe('.exists( id: string )', () => {
        beforeEach(() => service.create(before));

        it('should set expiration on the entry in database', async () => {
            await service.recycle(before.id);

            expect(await service.exists(before.id)).toBe(true);
            await new Promise(resolve => setTimeout(resolve, recycleTimeout * 1000));
            expect(await service.exists(before.id)).toBe(false);
        });
    });

    describe('.exists( key: `${string}:${string}` )', () => {
        beforeEach(() => service.create(before));

        it('should set expiration on the entry in database', async () => {
            const key = service.key(before.id);

            await service.recycle(before.id);

            expect(await service.exists(key)).toBe(true);
            await new Promise(resolve => setTimeout(resolve, recycleTimeout * 1000));
            expect(await service.exists(key)).toBe(false);
        });
    });

    describe('.create(model)', () => {
        it('should persist model fields/values', async () => {
            await service.create(before);

            const keys = Object.keys(before);
            const after = await redis.hmget(service.key(before), keys);

            expect(after).toEqual(keys.map(key => `${(before as any)[key]}`));
        });

        it('should return a promise with persisted model', async () => {
            const after = await service.create(before);

            expect(after).toEqual(before);
        });

        it('should return a promise with persisted model, different object than parameter', async () => {
            const after = await service.create(before);

            expect(after).not.toBe(before);
        });

        it('should return a promise with null, when key already exists', async () => {
            await service.create(before);

            const after = await service.create(before);

            expect(after).toEqual(null as never);
        });
    });

    describe('.update(/model/)', () => {
        beforeEach(() => service.create(before));

        it('should persist updated fields/values', async () => {
            const email = `${Math.random().toString(36).replace('.', '@')}.tld`;

            await service.update({ ...before, email });

            const keys = Object.keys(before);
            const after = await redis.hmget(service.key(before), keys);

            expect(after).toEqual(keys.map(key => 'email' === key ? email : `${(before as any)[key]}`));
        });

        it('should return a promise with updated model', async () => {
            const age = Math.random();
            const after = await service.update({ ...before, age });

            expect(after).toEqual({ ...before, age });
        });

        it('should return a promise with updated model, different object than parameter', async () => {
            const email = `${Math.random().toString(36).replace('.', '@')}.tld`;
            const beforeUpdate = { ...before, email };
            const after = await service.update(beforeUpdate);

            expect(after).not.toBe(beforeUpdate);
        });

        it('should return a promise with null, when key does not exists', async () => {
            const after = await service.update({ ...before, id: Math.random().toString(36) });

            expect(after).toEqual(null as never);
        });
    });

    describe('.search(string)', () => {
        beforeEach(() => service.create(before));

        it('should return promise of persisted model', async () => {
            const key = service.key({ id: before.id });
            const pulled = await service.search(key);

            expect(pulled).toEqual(before);
        });
    });

    describe('.search( key: `${string}:${string}` )', () => {
        beforeEach(() => service.create(before));

        it('should return promise of persisted model', async () => {
            const pulled = await service.search(service.key(before.id));

            expect(pulled).toEqual(before);
        });
    });

    describe('.recycle( id: string )', () => {
        beforeEach(() => service.create(before));

        it('should set expiration on the entry in database', async () => {
            const key = service.key(before.id);

            await service.recycle(key);

            expect(+await redis.ttl(key)).toBeGreaterThanOrEqual(1);
            expect(+await redis.ttl(key)).toBeLessThanOrEqual(recycleTimeout);
        });

        it('should delete entry from database, after `APPLICATION_RECYCLE_TIMEOUT` delay', async () => {
            const key = service.key({ id: before.id });

            await service.recycle(key);

            await new Promise(resolve => setTimeout(resolve, recycleTimeout * 1000));
            expect(await redis.exists(key)).toBe('0' as any);
        });
    });

    describe('.recycle( id: `${string}:${string}` )', () => {
        beforeEach(() => service.create(before));

        it('should set expiration on the entry in database', async () => {
            const key = service.key({ id: before.id });

            await service.recycle(service.key(before.id));

            expect(+await redis.ttl(key)).toBeGreaterThanOrEqual(1);
            expect(+await redis.ttl(key)).toBeLessThanOrEqual(recycleTimeout);
        });

        it('should delete entry from database, after `APPLICATION_RECYCLE_TIMEOUT` delay', async () => {
            const key = service.key({ id: before.id });

            await service.recycle(service.key(before.id));

            await new Promise(resolve => setTimeout(resolve, recycleTimeout * 1000));
            expect(await redis.exists(key)).toBe('0' as any);
        });
    });
});
