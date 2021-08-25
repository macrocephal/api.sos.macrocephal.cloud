import { Server } from '@hapi/hapi';
import faker from 'faker';
import { Redis } from 'ioredis';
import Joi from 'joi';
import { v4 } from 'uuid';
import { Client } from './../../../src/app/model/client';
import { User } from './../../../src/app/model/user';
import { RequestService } from './../../../src/app/service/request.service';
import { app } from './../../../src/conf/app';
import { APPLICATION_RECYCLE_TIMEOUT } from './../../../src/conf/create-env';
import { REDIS_TOKEN } from './../../../src/conf/create-redis';
import { SERVER_TOKEN } from './../../../src/conf/create-server';

describe('/requests', () => {
    beforeEach(async () => {
        ([server, redis, requestService] = await app()
            .register(APPLICATION_RECYCLE_TIMEOUT, () => recycleTimeout)
            .inject(SERVER_TOKEN, REDIS_TOKEN, RequestService));
        recycleTimeout = 1 + Math.round(2 * Math.random());
        await server.initialize();
        await redis.flushdb();

        const { id: userId } = (await server.inject({
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/users', payload: {
                email: faker.internet.email(),
            },
        })).result as any as User;
        client = (await server.inject({
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/clients', payload: {
                userAgent: faker.internet.userAgent(),
                userId,
            },
        })).result as any as Client;
    });

    afterEach(async () => {
        await redis.disconnect(false);
        await server.stop();
    });

    const getRadius = () => [
        faker.datatype.number({ min: 0, max: Number.MAX_SAFE_INTEGER, precision: 2 }) / 100,
        ['m', 'km', 'mi', 'ft'][Math.round(2 * Math.random())],
    ].join('');
    const getKind = () => faker.random.word().toUpperCase().replace(/-/g, '');

    let requestService: RequestService;
    let recycleTimeout: number;
    let server: Server;
    let client: Client;
    let redis: Redis;

    describe('/', () => {
        it('POST -> HTTP 201', async () => {
            const kind = getKind();
            const start = Date.now();
            const radius = getRadius();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/requests', payload: {
                    clientId: client.id,
                    radius,
                    kind,
                },
            });

            expect(statusCode).toBe(201);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search((result as any).id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(client.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (empty kind)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/requests', payload: {
                    clientId: client.id,
                    radius: getRadius(),
                    kind: '',
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('kind').required(),
                    label: Joi.valid('kind').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('kind').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (empty radius)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/requests', payload: {
                    clientId: client.id,
                    kind: getKind(),
                    radius: '',
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('radius').required(),
                    label: Joi.valid('radius').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('radius').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (invalid radius)', async () => {
            const radius = getRadius().replace(/^(.*)(m|km|mi|ft)$/, '$1');
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/requests', payload: {
                    clientId: client.id,
                    kind: getKind(),
                    radius,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    name: Joi.any(), // FIXME: improve this validation
                    regex: Joi.any(), // FIXME: improve this validation
                    value: Joi.valid(radius).required(),
                    key: Joi.valid('radius').required(),
                    label: Joi.valid('radius').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.pattern.base').required(),
                path: Joi.array().length(1).items(Joi.valid('radius').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (clientId not found)', async () => {
            const clientId = v4();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/requests', payload: {
                    radius: getRadius(),
                    kind: getKind(),
                    clientId,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(clientId).required(),
                    key: Joi.valid('clientId').required(),
                    label: Joi.valid('clientId').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('clientId.notFound').required(),
                path: Joi.array().length(1).items(Joi.valid('clientId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });
    });

    describe('/{id}', () => {
        beforeEach(async () => {
            start = Date.now();
            ({ id, kind, radius } = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/requests', payload: {
                    clientId: client.id,
                    radius: getRadius(),
                    kind: getKind(),
                },
            })).result as any);
        });

        let start: number;
        let radius: string;
        let kind: string;
        let id: string;

        it('PUT -> HTTP 205', async () => {
            const kind = getKind();
            const radius = getRadius();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    radius,
                    kind,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search(id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(client.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PUT -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/requests/${v4()}`, payload: {
                    clientId: client.id,
                    radius,
                    kind,
                },
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('PUT -> HTTP 422 (empty kind)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    kind: '',
                    radius,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('kind').required(),
                    label: Joi.valid('kind').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('kind').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PUT -> HTTP 422 (empty radius)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    radius: '',
                    kind,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('radius').required(),
                    label: Joi.valid('radius').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('radius').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PUT -> HTTP 422 (invalid radius)', async () => {
            const radius = getRadius().replace(/^(.*)(m|km|mi|ft)$/, '$1');
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    kind: getKind(),
                    radius,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    name: Joi.any(), // FIXME: improve this validation
                    regex: Joi.any(), // FIXME: improve this validation
                    value: Joi.valid(radius).required(),
                    key: Joi.valid('radius').required(),
                    label: Joi.valid('radius').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.pattern.base').required(),
                path: Joi.array().length(1).items(Joi.valid('radius').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PUT -> HTTP 422 (clientId not found)', async () => {
            const clientId = v4();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PUT', url: `/requests/${id}`, payload: {
                    clientId,
                    radius,
                    kind,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(clientId).required(),
                    key: Joi.valid('clientId').required(),
                    label: Joi.valid('clientId').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('clientId.notFound').required(),
                path: Joi.array().length(1).items(Joi.valid('clientId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 205', async () => {
            const kind = getKind();
            const radius = getRadius();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    radius,
                    kind,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search(id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(client.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 205 ({ kind })', async () => {
            const kind = getKind();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    kind,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search(id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(client.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 205 ({ radius })', async () => {
            const radius = getRadius();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    radius,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search(id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(client.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 205 ({ clientId })', async () => {
            const { id: clientId } = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/clients', payload: {
                    userAgent: faker.internet.userAgent(),
                    userId: client.userId,
                },
            })).result as any as Client;
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    clientId,
                },
            });

            expect(statusCode).toBe(205);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search(id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(clientId).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
                updatedAt: Joi.date().timestamp().min((result as any).createdAt!).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${v4()}`, payload: {
                    clientId: client.id,
                    radius,
                    kind,
                },
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('PATCH -> HTTP 422 (empty kind)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    kind: '',
                    radius,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('kind').required(),
                    label: Joi.valid('kind').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('kind').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 422 (empty radius)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    radius: '',
                    kind,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid('').required(),
                    key: Joi.valid('radius').required(),
                    label: Joi.valid('radius').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.empty').required(),
                path: Joi.array().length(1).items(Joi.valid('radius').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 422 (invalid radius)', async () => {
            const radius = getRadius().replace(/^(.*)(m|km|mi|ft)$/, '$1');
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    clientId: client.id,
                    kind: getKind(),
                    radius,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    name: Joi.any(), // FIXME: improve this validation
                    regex: Joi.any(), // FIXME: improve this validation
                    value: Joi.valid(radius).required(),
                    key: Joi.valid('radius').required(),
                    label: Joi.valid('radius').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('string.pattern.base').required(),
                path: Joi.array().length(1).items(Joi.valid('radius').required()).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('PATCH -> HTTP 422 (clientId not found)', async () => {
            const clientId = v4();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'PATCH', url: `/requests/${id}`, payload: {
                    clientId,
                    radius,
                    kind,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(clientId).required(),
                    key: Joi.valid('clientId').required(),
                    label: Joi.valid('clientId').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('clientId.notFound').required(),
                path: Joi.array().length(1).items(Joi.valid('clientId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });

        it('GET -> HTTP 200', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/requests/${id}`,
            });

            expect(statusCode).toBe(200);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await requestService.search(id));
            expect(Joi.object({
                kind: Joi.valid(kind).required(),
                radius: Joi.valid(radius).required(),
                clientId: Joi.valid(client.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('GET -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/requests/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });

        it('DELETE -> HTTP 204', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'DELETE', url: `/requests/${id}`,
            });

            expect(statusCode).toBe(204);
            expect(result).toBe(null as never);
            await new Promise(r => setTimeout(r, recycleTimeout * 1000));
            expect(null).toEqual(await requestService.search(id) as never);
        });

        it('DELETE -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'DELETE', url: `/requests/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });
    });
});
