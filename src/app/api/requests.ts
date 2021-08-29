import { RequestService } from './../service/request.service';
import Joi, { StringSchema } from 'joi';
import { v4 } from 'uuid';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { CREATED, ID, id, KIND, kind, radius, RADIUS, recycled, UPDATED, VALIDATION_ERRORS } from './util.schema';
import { clientIdExists } from './util.validator';

export const requests: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route([
        // TODO: Implement `GET /requests` after auth is in place
        {
            method: 'POST',
            path: '/requests',
            options: {
                tags: ['api', 'requests'],
                description: `Create a user's request`,
                response: {
                    status: {
                        201: Joi.object({
                            ...CREATED,
                            clientId: ID.id,
                            ...RADIUS,
                            ...KIND,
                        }).id('RequestCreated').label('RequestCreated'),
                        409: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        clientId: (ID.id as StringSchema).concat(
                            Joi.string().external(clientIdExists(container))
                        ),
                        ...RADIUS,
                        ...KIND,
                    }).label('RequestCreateRequest'),
                },
            },
            async handler(request, h) {
                const [requestService] = await container.inject(RequestService);
                const $request = await requestService.create({
                    ...request.payload as object,
                    id: v4(),
                } as never);

                return $request ? h.response($request).code(201) : h.response().code(404);
            },
        },
        {
            method: 'PUT',
            path: '/requests/{id}',
            options: {
                tags: ['api', 'requests'],
                description: `Update a user's request`,
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            clientId: ID.id,
                            ...RADIUS,
                            ...KIND,
                        }).id('RequestUpdated').label('RequestUpdated'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        clientId: (ID.id as StringSchema).concat(
                            Joi.string().external(clientIdExists(container))
                        ),
                        ...RADIUS,
                        ...KIND,
                    }).label('RequestUpdateRequest'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [requestService] = await container.inject(RequestService);
                const $request = await requestService.update({
                    ...request.payload as object,
                    id: request.params.id,
                });

                return $request ? h.response($request).code(205) : h.response().code(404);
            },
        },
        {
            method: 'PATCH',
            path: '/requests/{id}',
            options: {
                tags: ['api', 'requests'],
                description: `Partially update a user's request`,
                response: {
                    status: {
                        205: Joi.object({
                            ...recycled,
                            ...UPDATED,
                            clientId: ID.id,
                            ...RADIUS,
                            ...KIND,
                        }).id('RequestUpdated').label('RequestUpdated'),
                        404: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        ...kind,
                        ...radius,
                        clientId: (id.id as StringSchema).concat(
                            Joi.string().external(clientIdExists(container, true))
                        ),
                    }).label('RequestPatchRequest'),
                    params: Joi.object({
                        ...ID,
                    }),
                },
            },
            async handler(request, h) {
                const [requestService] = await container.inject(RequestService);
                const $request = await requestService.update({
                    ...request.payload as object,
                    id: request.params.id,
                });

                return $request ? h.response($request).code(205) : h.response().code(404);
            },
        },
        {
            method: 'GET',
            path: '/requests/{id}',
            options: {
                tags: ['api', 'requests'],
                description: `Get a user's request`,
                response: {
                    status: {
                        200: Joi.object({
                            ...recycled,
                            clientId: ID.id,
                            ...RADIUS,
                            ...KIND,
                        }).id('RequestRecorded').label('RequestRecorded'),
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
                const [requestService] = await container.inject(RequestService);
                const $request = await requestService.search(request.params.id);

                return $request ? h.response($request).code(200) : h.response().code(404);
            },
        },
        // TODO: Implement `GET /requests/{id}/dispatches`
        {
            method: 'DELETE',
            path: '/requests/{id}',
            options: {
                tags: ['api', 'requests'],
                description: `Delete a user's request`,
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
                const [requestService] = await container.inject(RequestService);
                const deleted = await requestService.recycle(request.params.id);

                return h.response().code(deleted ? 204 : 404);
            },
        },
    ]));
