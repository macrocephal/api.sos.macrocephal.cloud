import { Server } from '@hapi/hapi';
import faker from 'faker';
import { Redis } from 'ioredis';
import Joi from 'joi';
import { v4 } from 'uuid';
import { DispatchService } from '../../../src/app/service/dispatch.service';
import { Client } from './../../../src/app/model/client';
import { Request } from './../../../src/app/model/request';
import { User } from './../../../src/app/model/user';
import { app } from './../../../src/conf/app';
import { APPLICATION_RECYCLE_TIMEOUT } from './../../../src/conf/create-env';
import { REDIS_TOKEN } from './../../../src/conf/create-redis';
import { SERVER_TOKEN } from './../../../src/conf/create-server';

describe('/dispatches', () => {
    beforeEach(async () => {
        ([server, redis, dispatchService] = await (await app())
            .register(APPLICATION_RECYCLE_TIMEOUT, () => recycleTimeout)
            .inject(SERVER_TOKEN, REDIS_TOKEN, DispatchService));
        recycleTimeout = 1 + Math.round(2 * Math.random());
        await server.initialize();
        await redis.flushdb();

        const { id: userId } = (await server.inject({
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/users', payload: {
                email: faker.internet.email(),
            },
        })).result as any as User;
        const { id: clientId } = (await server.inject({
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/clients', payload: {
                userAgent: faker.internet.userAgent(),
                userId,
            },
        })).result as any as Client;
        (request = (await server.inject({
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/requests', payload: {
                radius: getRadius(),
                kind: getKind(),
                clientId,
            },
        })).result as any as Request);
    });

    afterEach(async () => {
        await redis.flushall();
        await redis.disconnect(false);
        await server.stop();
    });

    const getRadius = () => [
        faker.datatype.number({ min: 0, max: Number.MAX_SAFE_INTEGER, precision: 2 }) / 100,
        ['m', 'km', 'mi', 'ft'][Math.round(2 * Math.random())],
    ].join('');
    // @ts-ignore - Not all code paths return a value.ts(7030)
    const getKind = () => {
        for (let word; word = faker.random.word().toUpperCase();) {
            if (/^\w+$/.test(word)) return word;
        }
    };

    let dispatchService: DispatchService;
    let recycleTimeout: number;
    let request: Request;
    let server: Server;
    let redis: Redis;

    describe('/', () => {
        it('POST -> HTTP 201', async () => {
            const start = Date.now();
            const radius = getRadius();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/dispatches', payload: {
                    requestId: request.id,
                    radius,
                },
            });

            expect(statusCode).toBe(201);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await dispatchService.search((result as any).id));
            expect(Joi.object({
                radius: Joi.valid(radius).required(),
                requestId: Joi.valid(request.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 201 (missing radius falls back to request.radius)', async () => {
            const start = Date.now();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/dispatches', payload: {
                    requestId: request.id,
                },
            });

            expect(statusCode).toBe(201);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await dispatchService.search((result as any).id));
            expect(Joi.object({
                requestId: Joi.valid(request.id).required(),
                radius: Joi.valid(request.radius).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('POST -> HTTP 422 (empty radius)', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/dispatches', payload: {
                    requestId: request.id,
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
                method: 'POST', url: '/dispatches', payload: {
                    requestId: request.id,
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

        it('POST -> HTTP 422 (requestId not found)', async () => {
            const requestId = v4();
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/dispatches', payload: {
                    radius: getRadius(),
                    requestId,
                },
            });

            expect(statusCode).toBe(422);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(Joi.array().length(1).items(Joi.object({
                context: Joi.object({
                    value: Joi.valid(requestId).required(),
                    key: Joi.valid('requestId').required(),
                    label: Joi.valid('requestId').required(),
                }),
                message: Joi.string().required(),
                type: Joi.valid('requestId.notFound').required(),
                path: Joi.array().length(1).items(Joi.valid('requestId')).required(),
            })).required().validate(result).error).toBe(void 0);
        });
    });

    describe('/{id}', () => {
        beforeEach(async () => {
            start = Date.now();
            ({ id, radius } = (await server.inject({
                headers: { contentType: 'application/json' },
                method: 'POST', url: '/dispatches', payload: {
                    requestId: request.id,
                    radius: getRadius(),
                },
            })).result as any);
        });

        let radius: string;
        let start: number;
        let id: string;

        it('GET -> HTTP 200', async () => {
            const { headers, result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/dispatches/${id}`,
            });

            expect(statusCode).toBe(200);
            expect(headers['content-type']).toMatch(/application\/json/);
            expect(result).toEqual(await dispatchService.search(id));
            expect(Joi.object({
                radius: Joi.valid(radius).required(),
                requestId: Joi.valid(request.id).required(),
                id: Joi.string().uuid({ version: 'uuidv4' }).required(),
                createdAt: Joi.date().timestamp().min(start).max('now').required(),
            }).validate(result).error).toBe(void 0);
        });

        it('GET -> HTTP 404', async () => {
            const { result, statusCode } = await server.inject({
                headers: { contentType: 'application/json' },
                method: 'GET', url: `/dispatches/${v4()}`,
            });

            expect(result).toBe(null as never);
            expect(statusCode).toBe(404);
        });
    });
});
