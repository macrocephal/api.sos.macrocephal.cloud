import IORedis from 'ioredis';
import { Model } from '../../../src/app/model/model';
import { Service } from '../../../src/app/service/service';
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

    afterEach(async () => {
        await redis.flushall();
        await redis.disconnect(false);
    });

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
        beforeEach(() => service.create(before));

        it('should update `createdAt` to about now', async () => {
            before.id = Math.random().toString(36);

            const rightBefore = Date.now();
            const key = service.key(before.id);

            await service.create(before);

            const stamp = +(await redis.hget(key, 'createdAt'))!;

            expect(rightBefore).toBeLessThan(Date.now());
            expect(stamp).toBeGreaterThanOrEqual(rightBefore);
        });

        it('should persist model fields/values', async () => {
            const keys = Object.keys(before);
            const after = await redis.hmget(service.key(before), keys);

            expect(after).toEqual(keys.map(key => `${(before as any)[key]}`));
        });

        it('should return a promise with persisted model', async () => {
            before.id = Math.random().toString(36);

            const after = await service.create(before);

            expect(Object.entries(after).filter(([key]) => 'createdAt' !== key)).toEqual(Object.entries(before));
        });

        it('should return a promise with persisted model, different object than parameter', async () => {
            before.id = Math.random().toString(36);

            const after = await service.create(before);

            expect(after).not.toBe(before);
        });

        it('should return a promise with null, when key already exists', async () => {
            const after = await service.create(before);

            expect(after).toEqual(null as never);
        });
    });

    describe('.update(model)', () => {
        beforeEach(() => service.create(before));

        it('should update `updatedAt` to about now', async () => {
            const rightBefore = Date.now();
            const key = service.key(before.id);

            await service.update(before);

            const stamp = +(await redis.hget(key, 'updatedAt'))!;

            expect(rightBefore).toBeLessThan(Date.now());
            expect(stamp).toBeGreaterThanOrEqual(rightBefore);
        });

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

            expect(Object.entries(after).filter(([key]) => !['createdAt', 'updatedAt'].includes(key))).toEqual(Object.entries({ ...before, age }));
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

    describe('.update(Partial<model>) /** PATCH **/', () => {
        beforeEach(() => service.create(before));

        it('should update `updatedAt` to about now', async () => {
            const rightBefore = Date.now();
            const key = service.key(before.id);

            await service.update({ id: before.id });

            const stamp = +(await redis.hget(key, 'updatedAt'))!;

            expect(rightBefore).toBeLessThan(Date.now());
            expect(stamp).toBeGreaterThanOrEqual(rightBefore);
        });

        it('should persist updated fields/values', async () => {
            const email = `${Math.random().toString(36).replace('.', '@')}.tld`;

            await service.update({ id: before.id, email });

            const keys = Object.keys(before);
            const after = await redis.hmget(service.key(before), keys);

            expect(after).toEqual(keys.map(key => 'email' === key ? email : `${(before as any)[key]}`));
        });

        it('should return a promise with updated model', async () => {
            const age = Math.random();
            const after = await service.update({ id: before.id, age });

            expect(Object.entries(after).filter(([key]) => !['createdAt', 'updatedAt'].includes(key))).toEqual(Object.entries({ ...before, age }));
        });

        it('should return a promise with updated model, different object than parameter', async () => {
            const email = `${Math.random().toString(36).replace('.', '@')}.tld`;
            const beforeUpdate = { id: before.id, email };
            const after = await service.update(beforeUpdate);

            expect(after).not.toBe({ ...before, ...beforeUpdate });
        });

        it('should return a promise with null, when key does not exists', async () => {
            const after = await service.update({ id: Math.random().toString(36) });

            expect(after).toEqual(null as never);
        });
    });

    describe('.search( id: string )', () => {
        beforeEach(() => service.create(before));

        it('should return promise of persisted model', async () => {
            const key = service.key({ id: before.id });
            const pulled = await service.search(key);

            expect(Object.entries(pulled).filter(([key]) => 'createdAt' !== key)).toEqual(Object.entries(before));
        });

        it('[fix] should return null when `id` does not exist', async () => {
            const id = Math.random().toString(36);

            expect(await service.search(id)).toBe(null as never);
        });
    });

    describe('.search( key: `${string}:${string}` )', () => {
        beforeEach(() => service.create(before));

        it('should return promise of persisted model', async () => {
            const pulled = await service.search(service.key(before.id));

            expect(Object.entries(pulled).filter(([key]) => 'createdAt' !== key)).toEqual(Object.entries(before));
        });

        it('[fix] should return null when `id` does not exist', async () => {
            const id = Math.random().toString(36);
            const key = service.key(id);

            expect(await service.search(key)).toBe(null as never);
        });
    });

    describe('.recycle( id: string )', () => {
        beforeEach(() => service.create(before));

        it('should update `recycledAt` to about now', async () => {
            const key = service.key(before.id);
            const rightBefore = Date.now();

            await service.recycle(key);

            const stamp = +(await redis.hget(key, 'recycledAt'))!;

            expect(rightBefore).toBeLessThan(Date.now());
            expect(stamp).toBeGreaterThanOrEqual(rightBefore);
        });

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
