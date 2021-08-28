import Joi, { StringSchema } from 'joi';
import { v4 } from 'uuid';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { ClientService } from './../service/client.service';
import { Logger } from './../service/logger';
import { CREATED, ID, id, KIND, recycled, UPDATED, VALIDATION_ERRORS } from './util.schema';
import { userIdExists } from './util.validator';

export const clients: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route([
        // TODO: Implement `GET /clients` after auth is in place
        {
            method: 'POST',
            path: '/clients',
            options: {
                tags: ['api'],
                description: `Create a user's client`,
                response: {
                    status: {
                        201: Joi.object({
                            ...CREATED,
                            userId: ID.id,
                            userAgent: Joi.string().required(),
                        }).id('ClientCreated').label('ClientCreated'),
                        409: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        userAgent: Joi.string().required(),
                        userId: (ID.id as StringSchema).concat(
                            Joi.string().external(userIdExists(container))
                        ),
                    }).label('ClientCreateRequest'),
                },
            },
            async handler(request, h) {
                const [redis, clientService] = await container.inject(REDIS_TOKEN, ClientService);
                const client = await clientService.create({
                    ...request.payload as object,
                    id: v4(),
                } as never);

                if (client) {
                    await redis.sadd(`data:user-clients:${client.userId}`, client.id);
                    return h.response(client).code(201);
                } else {
                    return h.response().code(404);
                }
            },
        },
        {
            method: 'PUT',
            path: '/clients/{id}',
            options: {
                tags: ['api'],
                description: `Update a user's client`,
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            userId: ID.id,
                            userAgent: Joi.string().required(),
                        }).id('ClientUpdated').label('ClientUpdated'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        userAgent: Joi.string().required(),
                        userId: (ID.id as StringSchema).concat(
                            Joi.string().external(userIdExists(container))
                        ),
                    }).label('ClientUpdateRequest'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [clientService] = await container.inject(ClientService);
                const client = await clientService.update({
                    ...request.payload as object,
                    id: request.params.id,
                });

                return client ? h.response(client).code(205) : h.response().code(404);
            },
        },
        {
            method: 'PATCH',
            path: '/clients/{id}',
            options: {
                tags: ['api'],
                description: `Partially update a user's client`,
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            userId: ID.id,
                            userAgent: Joi.string().required(),
                        }).id('ClientUpdated').label('ClientUpdated'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        userAgent: Joi.string(),
                        userId: (id.id as StringSchema).concat(
                            Joi.string().external(userIdExists(container, true))
                        ),
                    }).label('ClientPatchRequest'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [clientService] = await container.inject(ClientService);
                const client = await clientService.update({
                    ...request.payload as object,
                    id: request.params.id,
                });

                return client ? h.response(client).code(205) : h.response().code(404);
            },
        },
        {
            method: 'GET',
            path: '/clients/{id}',
            options: {
                tags: ['api'],
                description: `Get a user's client`,
                response: {
                    status: {
                        200: Joi.object({
                            ...recycled,
                            userId: ID.id,
                            userAgent: Joi.string().required(),
                        }).id('ClientRecorded').label('ClientRecorded'),
                        404: Joi.valid().required(),
                    },
                },
                validate: {
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [clientService] = await container.inject(ClientService);
                const client = await clientService.search(request.params.id);

                return client ? h.response(client).code(200) : h.response().code(404);
            },
        },
        {
            method: 'DELETE',
            path: '/clients/{id}',
            options: {
                tags: ['api'],
                description: `Delete a user's client`,
                response: {
                    status: {
                        204: Joi.valid().required(),
                        404: Joi.valid().required(),
                    },
                },
                validate: {
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [redis, clientService] = await container.inject(REDIS_TOKEN, ClientService);
                const client = await clientService.search(request.params.id);
                const deleted = await clientService.recycle(request.params.id);


                if (deleted) {
                    await redis.srem(`data:user-clients:${client.userId}`, client.id);
                    return h.response(client).code(204);
                } else {
                    return h.response().code(404);
                }
            },
        },
        // Client's last position
        {
            method: 'POST',
            path: '/clients/{id}/position',
            options: {
                tags: ['api'],
                description: `Record a user's client current position`,
                response: {
                    status: {
                        201: Joi.valid().required(),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        latitude: Joi.number().min(-85.05112878).max(85.05112878).precision(8).required(),
                        longitude: Joi.number().min(-180).max(180).precision(8).required(),
                    }).id('Position').label('Position'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [redis, clientService, logger] = await container.inject(REDIS_TOKEN, ClientService, Logger);
                const { latitude, longitude } = request.payload as { latitude: number, longitude: number };
                const clientId = request.params.id;
                const clientKey = clientService.key(clientId);
                let result: number;

                try {
                    result = +await redis.eval(
                        `if 1 == redis.call('EXISTS', KEYS[1]) then
                            redis.call('GEOADD', KEYS[2], ARGV[1], ARGV[2], ARGV[3]);
                            return 1;
                        end

                        return 0`,
                        2, clientKey, `data:positions`, `${longitude}`, `${latitude}`, clientId);
                } catch (error) {
                    // NOTE: I sometimes got HTTP 500 during tests
                    logger.fatal('FIXME: Remove this error when bug is understood and fixed!');
                    logger.fatal('CONTEXT::', { latitude, longitude, clientId, clientKey });
                    throw error;
                }

                return h.response().code(result ? 204 : 404);
            },
        },
        // Client's candidacies
        {
            method: 'GET',
            path: '/clients/{id}/candidacies',
            options: {
                tags: ['api'],
                description: `Get a user's client`,
                response: {
                    status: {
                        200: Joi.array().items(KIND.kind as StringSchema).required(),
                        404: Joi.valid().required(),
                    },
                },
                validate: {
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [redis, clientService] = await container.inject(REDIS_TOKEN, ClientService);
                const { userId } = (await clientService.search(request.params.id)) ?? {};

                if (userId) {
                    const kinds: string[] = [];
                    const keys = await redis.keys('data:candidacies:*');
                    const promises = (keys).map(key => redis.zscore(key, userId));

                    for (let i = 0, l = promises.length; i < l; i++) {
                        if (null !== await promises[i]) {
                            kinds.push(keys[i]!.split('data:candidacies:')?.[1]!);
                        }
                    }

                    return h.response(kinds).code(200)
                } else {

                    return h.response().code(404);
                }
            },
        },
        {
            method: 'POST',
            path: '/clients/{id}/candidacies',
            options: {
                tags: ['api'],
                description: 'Enable or disable requesters\'s kind',
                response: {
                    status: {
                        204: Joi.valid().required(),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        ...KIND,
                        enabled: Joi.boolean().default(true),
                    }).id('Candidacy').label('Candidacy'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [redis, clientService] = await container.inject(REDIS_TOKEN, ClientService);
                const { kind, enabled } = request.payload as { kind: string, enabled: boolean };
                const { userId } = await clientService.search(request.params.id) ?? {};
                const [, nanos] = process.hrtime();
                const score = BigInt(Date.now()) * 1000n + (BigInt(nanos) % 1_000n);

                if (userId) {
                    if (enabled) {
                        await redis.zadd(`data:candidacies:${kind}`, score.toString(), userId);
                    } else {
                        await redis.zrem(`data:candidacies:${kind}`, userId);
                    }

                    return h.response().code(204);
                } else {
                    return h.response().code(404);
                }
            },
        },
    ]));
