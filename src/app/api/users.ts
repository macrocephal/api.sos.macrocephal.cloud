import Joi from 'joi';
import { v4 } from 'uuid';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { UserService } from './../service/user.service';
import { CREATED, ID, recycled, UPDATED, VALIDATION_ERRORS } from './schema';

export const users: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route([
        {
            method: 'POST',
            path: '/users',
            options: {
                tags: ['api'],
                description: 'Create a user',
                response: {
                    status: {
                        201: Joi.object({
                            ...CREATED,
                            email: Joi.string().email().required(),
                        }).id('CreatedUser').label('CreatedUser'),
                        409: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email().required(),
                    }).label('PostUser'),
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
                tags: ['api'],
                description: 'Update a user',
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            email: Joi.string().email().required(),
                        }).id('UpdatedUser').label('UpdatedUser'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email().required(),
                    }).label('PutUser'),
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
                tags: ['api'],
                description: 'Update a user',
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            email: Joi.string().email().required(),
                        }).id('UpdatedUser').label('UpdatedUser'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email(),
                    }).label('PatchUser'),
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
                tags: ['api'],
                description: 'Get a user',
                response: {
                    status: {
                        200: Joi.object({
                            ...recycled,
                            email: Joi.string().email().required(),
                        }).id('ExistingUser').label('ExistingUser'),
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
            method: 'DELETE',
            path: '/users/{id}',
            options: {
                tags: ['api'],
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
