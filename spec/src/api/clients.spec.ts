import { Server } from '@hapi/hapi';
import faker from 'faker';
import { Redis } from 'ioredis';
import Joi from 'joi';
import { v4 } from 'uuid';
import { Client } from './../../../src/app/model/client';
import { User } from './../../../src/app/model/user';
import { ClientService } from './../../../src/app/service/client.service';
import { app } from './../../../src/conf/app';
import { APPLICATION_RECYCLE_TIMEOUT } from './../../../src/conf/create-env';
import { REDIS_TOKEN } from './../../../src/conf/create-redis';
import { SERVER_TOKEN } from './../../../src/conf/create-server';

describe('/clients', () => {
    beforeEach(async () => {
        ([server, redis, clientService] = await app()
            .register(APPLICATION_RECYCLE_TIMEOUT, () => recycleTimeout)
            .inject(SERVER_TOKEN, REDIS_TOKEN, ClientService));
        recycleTimeout = 1 + Math.round(2 * Math.random());
        await server.initialize();
        await redis.flushdb();
        // @ts-ignore - Type 'object | undefined' is not assignable to type 'User'.
        //                  Type 'undefined' is not assignable to type 'User'.ts(2322)
        ({ result: user } = await server.inject({
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/users', payload: {
                email: faker.internet.email(),
            },
        }));
    });

    afterEach(async () => {
        await redis.disconnect(false);
        await server.stop();
    });

    let clientService: ClientService;
    let recycleTimeout: number;
    let server: Server;
    let redis: Redis;
    let user: User;

    describe('/', () => {
        it('POST -> HTTP 201', async () => {
            const start = Date.now();
            const userAgent = faker.internet.userAgent();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userId: user.id,
                    userAgent,
                },
            });

            expect(statusCode).toBe(201);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await clientService.search((result as any).id));
            expect(Joi.object({
                userId: Joi.valid(user.id).required(),
                userAgent: Joi.valid(userAgent).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (empty userAgent)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userId: user.id,
                    userAgent: '',
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('userAgent').required(),
                    label: Joi.valid('userAgent').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('userAgent').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (userId not found)', async () => {
            const userId = v4();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(userId).required(),
                    key: Joi.valid('userId').required(),
                    label: Joi.valid('userId').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('userId.notFound').required(),
                path: Joi.array().length(1).items(Joi.valid('userId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });
    });

    describe('/{id}', () => {
        it('PUT -> HTTP 205', async () => {
            const start = Date.now();
            const userAgent = faker.internet.userAgent();
            const { id }: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/clients/${id}`, payload: {
                    userId: user.id,
                    userAgent,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await clientService.search(id));
            expect(Joi.object({
                userId: Joi.valid(user.id).required(),
                userAgent: Joi.valid(userAgent).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PUT -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/clients/${v4()}`, payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('PUT -> HTTP 422 (blank userAgent)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/clients/${v4()}`, payload: {
                    userAgent: null,
                    userId: user.id,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(null).required(),
                    key: Joi.valid('userAgent').required(),
                    label: Joi.valid('userAgent').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.base').required(),
                path: Joi.array().length(1).items(Joi.valid('userAgent').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PUT -> HTTP 422 (userId not found)', async () => {
            const userId = v4();
            const { id } = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as Client;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/clients/${id}`, payload: {
                    userAgent: faker.internet.userAgent(),
                    userId,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(userId),
                    key: Joi.valid('userId'),
                    label: Joi.valid('userId'),
                }).unknown(),
                message: Joi.string().required(),
                type: Joi.valid('userId.notFound'),
                path: Joi.array().length(1).items(Joi.valid('userId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 205', async () => {
            const start = Date.now();
            const userAgent = faker.internet.userAgent();
            const { id }: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/clients/${id}`, payload: {
                    userAgent,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await clientService.search(id));
            expect(Joi.object({
                userId: Joi.valid(user.id).required(),
                userAgent: Joi.valid(userAgent).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/clients/${v4()}`, payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('PATCH -> HTTP 422 (null userAgent)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/clients/${v4()}`, payload: {
                    userAgent: null,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(null).required(),
                    key: Joi.valid('userAgent').required(),
                    label: Joi.valid('userAgent').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.base').required(),
                path: Joi.array().length(1).items(Joi.valid('userAgent').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 422 (userId not found)', async () => {
            const userId = v4();
            const { id } = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as Client;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/clients/${id}`, payload: {
                    userId,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(userId),
                    key: Joi.valid('userId'),
                    label: Joi.valid('userId'),
                }).unknown(),
                message: Joi.string().required(),
                type: Joi.valid('userId.notFound'),
                path: Joi.array().length(1).items(Joi.valid('userId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('GET -> HTTP 200', async () => {
            const start = Date.now();
            const userAgent = faker.internet.userAgent();
            const { id }: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userId: user.id,
                    userAgent,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/clients/${id}`,
            });

            expect(statusCode).toBe(200);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await clientService.search(id));
            expect(Joi.object({
                userId: Joi.valid(user.id).required(),
                userAgent: Joi.valid(userAgent).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('GET -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/clients/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('DELETE -> HTTP 204', async () => {
            const { id }: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as any;
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'DELETE', url: `/clients/${id}`,
            });

            expect(statusCode).toBe(204);
            expect(result).toBe(null as never);
            await new Promise(r => setTimeout(r, recycleTimeout * 1000));
            expect(null).toEqual(await clientService.search(id) as never);
        });

        it('DELETE -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'DELETE', url: `/clients/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });
    });
});
