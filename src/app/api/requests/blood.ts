import Joi from 'joi';
import { SERVER_TOKEN } from '../../../conf/create-server';
import { FIREBASE_STRATEGY } from '../../../conf/create-server-plugin';
import { Container } from '../../../container';
import { Logger } from '../../service/logger';
import { CREATED, ID, UNAUTHORIZED_ERROR, VALIDATION_ERRORS } from '../util.schema';
import { BloodRequestService } from './../../service/blood-request.service';
import { WithApplication } from './../../with-application';

export const bloodRequests: Container.Visitor = container => container
    .inject(Logger, SERVER_TOKEN, BloodRequestService)
    .then(([logger, server, bloodRequestService]) =>
        server.route([
            {
                method: 'POST',
                path: '/requests/blood',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'request:blood'],
                    description: 'Request a new blood donation',
                    response: {
                        status: {
                            201: Joi.object({
                                ...CREATED,
                                userId: Joi.string().required(),
                                active: Joi.valid(true).required(),
                                rhesusFactor: Joi.valid('+', '-').required(),
                                bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                            }).id('BloodRequestCreated').label('BloodRequestCreated'),
                            401: UNAUTHORIZED_ERROR,
                            404: Joi.valid().required(),
                            409: Joi.valid().required(),
                            422: VALIDATION_ERRORS,
                        },
                    },
                    validate: {
                        payload: Joi.object({
                            rhesusFactor: Joi.valid('+', '-').required(),
                            bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                            longitude: Joi.number().min(-180).max(180).precision(8).required(),
                            latitude: Joi.number().min(-85.05112878).max(85.05112878).precision(8).required(),
                        }).id('BloodRequest').label('BloodRequest'),
                    },
                },
                async handler(request, h) {
                    const userId = request.auth.credentials.user_id as string;

                    try {
                        const bloodRequest = await bloodRequestService.create(userId, request.payload as any);

                        return h.response(bloodRequest).code(201);
                    } catch (error: any) {
                        logger.error(error);

                        switch (error?.name) {
                            case WithApplication.ERROR_CONFLICT:
                                return h.response().code(409);
                            case WithApplication.ERROR_NOT_FOUND:
                                return h.response().code(404);
                        }

                        throw error;
                    }
                },
            },
            {
                method: 'POST',
                path: '/requests/blood/{requestId}/dispatch',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'request:blood'],
                    description: 'Dispatch a blood donation request',
                    response: {
                        status: {
                            204: Joi.valid().required(),
                            401: UNAUTHORIZED_ERROR,
                            404: Joi.valid().required(),
                            409: Joi.valid().required(),
                        },
                    },
                    validate: {
                        payload: Joi.object({
                            longitude: Joi.number().min(-180).max(180).precision(8).required(),
                            latitude: Joi.number().min(-85.05112878).max(85.05112878).precision(8).required(),
                        }).id('BloodDispatchRequest').label('BloodDispatchRequest'),
                        params: Joi.object({
                            requestId: ID.id,
                        }),
                    },
                },
                async handler(request, h) {
                    const userId = request.auth.credentials.user_id as string;
                    const { requestId } = request.params;

                    try {
                        const dispatch = await bloodRequestService.dispatch(userId, requestId, request.payload as any);

                        return h.response(dispatch).code(201);
                    } catch (error: any) {
                        logger.error(error);

                        switch (error?.name) {
                            case WithApplication.ERROR_CONFLICT:
                                return h.response().code(409);
                            case WithApplication.ERROR_NOT_FOUND:
                                return h.response().code(404);
                        }

                        throw error;
                    }
                },
            },
        ])
    );
