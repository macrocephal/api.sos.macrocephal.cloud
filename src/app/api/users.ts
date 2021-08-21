import Joi from 'joi';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { CREATED, VALIDATION_ERRORS } from './schema';

export const users: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route([
        {
            method: 'POST',
            path: '/users',
            options: {
                tags: ['api'],
                description: 'Create a users',
                response: {
                    status: {
                        201: Joi.object({
                            ...CREATED,
                            email: Joi.string().email().required(),
                        }).label('CreatedUser'),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        email: Joi.string().email().required(),
                    }).label('PostUser'),
                },
            },
            handler(request, h) {
                return h.response({
                    url: request.url,
                    method: request.method,
                    payload: request.payload,
                });
            },
        },
    ]));
