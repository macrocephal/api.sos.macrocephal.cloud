import Joi from 'joi';
import { v4 } from 'uuid';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { REDIS_TOKEN } from './../../conf/create-redis';
import { ClientService } from './../service/client.service';
import { UserService } from './../service/user.service';
import { CREATED, ID, recycled, UPDATED, VALIDATION_ERRORS } from './util.schema';

export const users: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route([
        {
            method: 'POST',
            path: '/users',
            options: {
                tags: ['api', 'users'],
                description: 'Create a user',
                response: {
                    status: {
                        201: Joi.object({
                            ...CREATED,
                            email: Joi.string().email().required(),
                        }).id('UserCreated').label('UserCreated'),
                        409: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email().required(),
                    }).label('UserCreateRequest'),
                },
            },
            async handler(request, h) {
                const [userService] = await container.inject(UserService);
                const user = await userService.create({
                    ...request.payload as object,
                    id: v4(),
                } as never);

                return user ? h.response(user).code(201) : h.response().code(404);
            },
        },
        {
            method: 'PUT',
            path: '/users/{id}',
            options: {
                tags: ['api', 'users'],
                description: 'Update a user',
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            email: Joi.string().email().required(),
                        }).id('UserUpdated').label('UserUpdated'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email().required(),
                    }).label('UserUpdateRequest'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [userService] = await container.inject(UserService);
                const user = await userService.update({
                    ...request.payload as object,
                    id: request.params.id,
                });

                return user ? h.response(user).code(205) : h.response().code(404);
            },
        },
        {
            method: 'PATCH',
            path: '/users/{id}',
            options: {
                tags: ['api', 'users'],
                description: 'Partially update a user',
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            email: Joi.string().email().required(),
                        }).id('UserUpdated').label('UserUpdated'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email(),
                    }).label('UserPatchRequest'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [userService] = await container.inject(UserService);
                const user = await userService.update({
                    ...request.payload as object,
                    id: request.params.id,
                });

                return user ? h.response(user).code(205) : h.response().code(404);
            },
        },
        {
            method: 'GET',
            path: '/users/{id}',
            options: {
                tags: ['api', 'users'],
                description: 'Get a user',
                response: {
                    status: {
                        200: Joi.object({
                            ...recycled,
                            email: Joi.string().email().required(),
                        }).id('UserRecorded').label('UserRecorded'),
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
                const [userService] = await container.inject(UserService);
                const user = await userService.search(request.params.id);

                return user ? h.response(user).code(200) : h.response().code(404);
            },
        },
        {
            method: 'GET',
            path: '/users/{id}/clients',
            options: {
                tags: ['api', 'users'],
                description: `Get a user's clients`,
                response: {
                    status: {
                        200: Joi.array().items(
                            Joi.object({
                                ...recycled,
                                userId: ID.id,
                                userAgent: Joi.string().required(),
                            }).id('ClientRecorded').label('ClientRecorded')
                        ).id('UserClients').label('UserClients'),
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
                const [redis, userService, clientService] = await container.inject(REDIS_TOKEN, UserService, ClientService);
                const userId = request.params.id;

                if (await userService.exists(userId)) {
                    const clientIds = await redis.smembers(`data:user-clients:${userId}`);
                    const clients = await Promise.all(clientIds.map(clientId => clientService.search(clientId)));

                    return h.response(clients).code(200);
                } else {
                    return h.response().code(404);
                }
            },
        },
        {
            method: 'DELETE',
            path: '/users/{id}',
            options: {
                tags: ['api', 'users'],
                description: 'Delete a user',
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
                const [userService] = await container.inject(UserService);
                const deleted = await userService.recycle(request.params.id);

                return h.response().code(deleted ? 204 : 404);
            },
        },
    ]));
