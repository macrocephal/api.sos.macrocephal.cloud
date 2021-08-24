import { Server } from '@hapi/hapi';
import faker from 'faker';
import { Redis } from 'ioredis';
import Joi, { ValidationErrorItem } from 'joi';
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
        user
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
            const client: Client = result as any;

            expect(statusCode).toBe(201);
            expect(Joi.object({
                userAgent: Joi.string().required(),
                createdAt: Joi.date().timestamp().required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(client).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(client).toEqual(await clientService.search(client.id));
            expect(client.createdAt).toBeLessThanOrEqual(Date.now());
            expect(client.createdAt).toBeGreaterThanOrEqual(start);
            expect(client.userAgent).toBe(userAgent);
            expect(client.userId).toBe(user.id);
        });

        it('POST -> HTTP 422 (empty userAgent)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userId: user.id,
                    userAgent: '',
                },
            });
            const error: ValidationErrorItem[] = result as any;

            expect(Joi.array().items(
                Joi.object({
                    context: Joi.object({
                        value: Joi.any(),
                        key: Joi.string(),
                        label: Joi.string(),
                    }).unknown(),
                    type: Joi.string().required(),
                    message: Joi.string().required(),
                    path: Joi.array().items(
                        Joi.string(), Joi.number()
                    ).required(),
                }),
            ).required().validate(error).error).toBe(void 0);


            expect(error.some(({ path }) => path[0] === 'userAgent')).toBe(true);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(statusCode).toBe(422);
            expect(error).toHaveSize(1);
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
                    value: Joi.valid(userId),
                    key: Joi.valid('userId'),
                    label: Joi.valid('userId'),
                }).unknown(),
                message: Joi.string().required(),
                type: Joi.valid('userId.notFound'),
                path: Joi.array().length(1).items(Joi.valid('userId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });
    });

    describe('/{id}', () => {
        it('PUT -> HTTP 205', async () => {
            const start = Date.now();
            const userAgent = faker.internet.userAgent();
            const initial: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/clients/${initial.id}`, payload: {
                    userId: user.id,
                    userAgent,
                },
            });
            const client: Client = result as any;

            expect(statusCode).toBe(205);
            expect(Joi.object({
                userAgent: Joi.string().required(),
                recycledAt: Joi.date().timestamp(),
                createdAt: Joi.date().timestamp().required(),
                updatedAt: Joi.date().timestamp().required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(client).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(client).toEqual(await clientService.search(initial.id));
            expect(client.updatedAt).toBeGreaterThanOrEqual(initial.createdAt!);
            expect(client.updatedAt).toBeLessThanOrEqual(Date.now());
            expect(client.createdAt).toBeLessThanOrEqual(Date.now());
            expect(client.createdAt).toBeGreaterThanOrEqual(start);
            expect(client.userAgent).toBe(userAgent);
            expect(client.userId).toBe(user.id);
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
            const error: ValidationErrorItem[] = result as any;

            expect(Joi.array().items(
                Joi.object({
                    context: Joi.object({
                        value: Joi.any(),
                        key: Joi.string(),
                        label: Joi.string(),
                    }).unknown(),
                    type: Joi.string().required(),
                    message: Joi.string().required(),
                    path: Joi.array().items(
                        Joi.string(), Joi.number()
                    ).required(),
                }),
            ).required().validate(error).error).toBe(void 0);
            expect(error.some(({ path }) => path[0] === 'userAgent')).toBe(true);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(statusCode).toBe(422);
            expect(error).toHaveSize(1);
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
            const initial: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: user.id,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/clients/${initial.id}`, payload: {
                    userAgent,
                },
            });
            const client: Client = result as any;


            expect(statusCode).toBe(205);
            expect(Joi.object({
                userAgent: Joi.string().required(),
                recycledAt: Joi.date().timestamp(),
                createdAt: Joi.date().timestamp().required(),
                updatedAt: Joi.date().timestamp().required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(client).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(client).toEqual(await clientService.search(initial.id));
            expect(client.updatedAt).toBeGreaterThanOrEqual(initial.createdAt!);
            expect(client.updatedAt).toBeLessThanOrEqual(Date.now());
            expect(client.createdAt).toBeLessThanOrEqual(Date.now());
            expect(client.createdAt).toBeGreaterThanOrEqual(start);
            expect(client.userAgent).toBe(userAgent);
            expect(client.userId).toBe(user.id);
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
            const error: ValidationErrorItem[] = result as any;

            expect(Joi.array().items(
                Joi.object({
                    context: Joi.object({
                        value: Joi.any(),
                        key: Joi.string(),
                        label: Joi.string(),
                    }).unknown(),
                    type: Joi.string().required(),
                    message: Joi.string().required(),
                    path: Joi.array().items(
                        Joi.string(), Joi.number()
                    ).required(),
                }),
            ).required().validate(error).error).toBe(void 0);
            expect(error.some(({ path }) => path[0] === 'userAgent')).toBe(true);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(statusCode).toBe(422);
            expect(error).toHaveSize(1);
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
            const initial: Client = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userId: user.id,
                    userAgent,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/clients/${initial.id}`,
            });
            const client: Client = result as any;

            expect(statusCode).toBe(200);
            expect(Joi.object({
                updatedAt: Joi.date().timestamp(),
                recycledAt: Joi.date().timestamp(),
                userAgent: Joi.string().required(),
                createdAt: Joi.date().timestamp().required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(client).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(client).toEqual(await clientService.search(initial.id));
            expect(client.createdAt).toBeLessThanOrEqual(Date.now());
            expect(client.createdAt).toBeGreaterThanOrEqual(start);
            expect(client.userAgent).toBe(userAgent);
            expect(client.userId).toBe(user.id);
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
