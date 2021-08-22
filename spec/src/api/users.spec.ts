import { Server } from '@hapi/hapi';
import { Redis } from 'ioredis';
import Joi, { ValidationErrorItem } from 'joi';
import { v4 } from 'uuid';
import { User } from './../../../src/app/model/user';
import { UserService } from './../../../src/app/service/user.service';
import { app } from './../../../src/conf/app';
import { APPLICATION_RECYCLE_TIMEOUT } from './../../../src/conf/create-env';
import { REDIS_TOKEN } from './../../../src/conf/create-redis';
import { SERVER_TOKEN } from './../../../src/conf/create-server';

describe('/users', () => {
    beforeEach(async () => {
        ([server, redis, userService] = await app()
            .register(APPLICATION_RECYCLE_TIMEOUT, () => recycleTimeout)
            .inject(SERVER_TOKEN, REDIS_TOKEN, UserService));
        recycleTimeout = 1 + Math.round(2 * Math.random());
        await server.initialize();
        await redis.flushdb();
    });

    afterEach(async () => {
        await redis.disconnect(false);
        await server.stop();
    });

    let userService: UserService;
    let recycleTimeout: number;
    let server: Server;
    let redis: Redis;

    describe('/', () => {
        it('POST -> HTTP 201', async () => {
            const start = Date.now();
            const email = 'john.doe@email.org';
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/users', payload: {
                    email,
                },
            });
            const user: User = result as any;

            expect(statusCode).toBe(201);
            expect(Joi.object({
                email: Joi.string().email().required(),
                createdAt: Joi.date().timestamp().required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(user).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(user).toEqual(await userService.search(user.id));
            expect(user.createdAt).toBeLessThanOrEqual(Date.now());
            expect(user.createdAt).toBeGreaterThanOrEqual(start);
            expect(user.email).toBe(email);
        });

        // TODO: implement & test HTTP 409 Conflict - existing user with the given email

        it('POST -> HTTP 422 (bad email)', async () => {
            const email = 'bad.email@dom.ain';
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/users', payload: {
                    email,
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
            expect(error.some(({ path }) => path[0] === 'email')).toBe(true);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(statusCode).toBe(422);
            expect(error).toHaveSize(1);
        });
    });

    describe('/{id}', () => {
        it('PUT -> HTTP 205', async () => {
            const start = Date.now();
            const email = 'jane.doe@email.org';
            const initial: User = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/users', payload: {
                    email: 'john.doe@email.org',
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/users/${initial.id}`, payload: {
                    email,
                },
            });
            const user: User = result as any;

            expect(statusCode).toBe(205);
            expect(Joi.object({
                email: Joi.string().email().required(),
                createdAt: Joi.date().timestamp().required(),
                updatedAt: Joi.date().timestamp().required(),
                // TODO: optional recycledAt
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(user).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(user).toEqual(await userService.search(initial.id));
            expect(user.updatedAt).toBeGreaterThanOrEqual(initial.createdAt!);
            expect(user.updatedAt).toBeLessThanOrEqual(Date.now());
            expect(user.createdAt).toBeLessThanOrEqual(Date.now());
            expect(user.createdAt).toBeGreaterThanOrEqual(start);
            expect(user.email).toBe(email);
        });

        it('PUT -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/users/${v4()}`, payload: {
                    email: 'jane.done@example.com',
                },
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('PUT -> HTTP 422 (bad email)', async () => {
            const email = 'bad.email@dom.ain';
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/users/${v4()}`, payload: {
                    email,
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
            expect(error.some(({ path }) => path[0] === 'email')).toBe(true);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(statusCode).toBe(422);
            expect(error).toHaveSize(1);
        });

        it('PATCH -> HTTP 205', async () => {
            const start = Date.now();
            const email = 'jane.doe@email.org';
            const initial: User = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/users', payload: {
                    email: 'john.doe@email.org',
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/users/${initial.id}`, payload: {
                    email,
                },
            });
            const user: User = result as any;

            expect(statusCode).toBe(205);
            expect(Joi.object({
                email: Joi.string().email().required(),
                createdAt: Joi.date().timestamp().required(),
                updatedAt: Joi.date().timestamp().required(),
                // TODO: optional recycledAt
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(user).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(user).toEqual(await userService.search(initial.id));
            expect(user.updatedAt).toBeGreaterThanOrEqual(initial.createdAt!);
            expect(user.updatedAt).toBeLessThanOrEqual(Date.now());
            expect(user.createdAt).toBeLessThanOrEqual(Date.now());
            expect(user.createdAt).toBeGreaterThanOrEqual(start);
            expect(user.email).toBe(email);
        });

        it('PATCH -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/users/${v4()}`, payload: {
                    email: 'jane.done@example.com',
                },
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('PATCH -> HTTP 422 (bad email)', async () => {
            const email = 'bad.email@dom.ain';
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/users/${v4()}`, payload: {
                    email,
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
            expect(error.some(({ path }) => path[0] === 'email')).toBe(true);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(statusCode).toBe(422);
            expect(error).toHaveSize(1);
        });

        it('GET -> HTTP 200', async () => {
            const start = Date.now();
            const email = 'jane.doe@email.org';
            const initial: User = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/users', payload: {
                    email,
                },
            })).result as any;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/users/${initial.id}`,
            });
            const user: User = result as any;

            expect(statusCode).toBe(200);
            expect(Joi.object({
                updatedAt: Joi.date().timestamp(),
                recycledAt: Joi.date().timestamp(),
                email: Joi.string().email().required(),
                createdAt: Joi.date().timestamp().required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
            }).validate(user).error).toBe(void 0);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(user).toEqual(await userService.search(initial.id));
            expect(user.createdAt).toBeLessThanOrEqual(Date.now());
            expect(user.createdAt).toBeGreaterThanOrEqual(start);
            expect(user.email).toBe(email);
        });

        it('GET -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/users/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('DELETE -> HTTP 204', async () => {
            const { id }: User = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/users', payload: {
                    email: 'jane.doe@email.org',
                },
            })).result as any;
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'DELETE', url: `/users/${id}`,
            });

            expect(statusCode).toBe(204);
            expect(result).toBe(null as never);
            await new Promise(r => setTimeout(r, recycleTimeout * 1000));
            expect(null).toEqual(await userService.search(id) as never);
        });

        it('DELETE -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'DELETE', url: `/users/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });
    });
});
