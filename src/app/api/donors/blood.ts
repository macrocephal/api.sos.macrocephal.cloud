import Joi from 'joi';
import { SERVER_TOKEN } from './../../../conf/create-server';
import { FIREBASE_STRATEGY } from './../../../conf/create-server-plugin';
import { Container } from './../../../container';
import { BloodDonorService } from './../../service/blood-donor.service';
import { Logger } from './../../service/logger';
import { WithApplication } from './../../with-application';
import { CREATED, UNAUTHORIZED_ERROR, UPDATED, VALIDATION_ERRORS } from './../util.schema';

export const bloodDonors: Container.Visitor = container => container
    .inject(Logger, SERVER_TOKEN, BloodDonorService)
    .then(([logger, server, bloodDonorService]) =>
        server.route([
            {
                method: 'POST',
                path: '/donors/blood',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'donor:blood'],
                    description: 'Register a new blood donor',
                    response: {
                        status: {
                            201: Joi.object({
                                ...CREATED,
                                rhesusFactor: Joi.valid('+', '-'),
                                bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                            }).id('BloodDonorCreated').label('BloodDonorCreated'),
                            401: UNAUTHORIZED_ERROR,
                            422: VALIDATION_ERRORS,
                        },
                    },
                    validate: {
                        payload: Joi.object({
                            rhesusFactor: Joi.valid('+', '-'),
                            bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                        }).id('BloodDonorCreateRequest').label('BloodDonorCreateRequest'),
                    }
                },
                async handler(request, h) {
                    const userId = request.auth.credentials.user_id as string;
                    const donor = await bloodDonorService.create(userId, request.payload as any);

                    return h.response(donor).code(201);
                }
            },
            {
                method: 'PUT',
                path: '/donors/blood',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'donor:blood'],
                    description: 'Register a new blood donor',
                    response: {
                        status: {
                            200: Joi.object({
                                ...UPDATED,
                                rhesusFactor: Joi.valid('+', '-'),
                                bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                            }).id('BloodDonorUpdated').label('BloodDonorUpdated'),
                            401: UNAUTHORIZED_ERROR,
                            404: Joi.valid().required(),
                            422: VALIDATION_ERRORS,
                        },
                    },
                    validate: {
                        payload: Joi.object({
                            rhesusFactor: Joi.valid('+', '-', null).required(),
                            bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                        }).id('BloodDonorUpdateRequest').label('BloodDonorUpdateRequest'),
                    }
                },
                async handler(request, h) {
                    const userId = request.auth.credentials.user_id as string;

                    try {
                        const donor = await bloodDonorService.update(userId, request.payload as any);

                        return h.response(donor).code(200);
                    } catch (error: any) {
                        logger.error(error);

                        switch (error?.name) {
                            case WithApplication.ERROR_NOT_FOUND:
                                return h.response().code(404);
                        }

                        throw error;
                    }
                }
            },
            {
                method: 'DELETE',
                path: '/donors/blood',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'donor:blood'],
                    description: 'Delete blood donor',
                    response: {
                        status: {
                            204: Joi.valid().required(),
                            401: UNAUTHORIZED_ERROR,
                            404: Joi.valid().required(),
                        },
                    }
                },
                async handler(request, h) {
                    const userId = request.auth.credentials.user_id as string;

                    try {
                        await bloodDonorService.delete(userId);

                        return h.response().code(204);
                    } catch (error: any) {
                        logger.error(error);

                        if (WithApplication.ERROR_NOT_FOUND === error.name) {
                            return h.response().code(404);
                        }

                        throw error;
                    }
                }
            },
            {
                method: 'PUT',
                path: '/donors/blood/position',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'donor:blood'],
                    description: 'Update blood donor coordinates',
                    response: {
                        status: {
                            204: Joi.valid().required(),
                            401: UNAUTHORIZED_ERROR,
                            404: Joi.valid().required(),
                            422: VALIDATION_ERRORS,
                        },
                    },
                    validate: {
                        payload: Joi.object({
                            longitude: Joi.number().min(-180).max(180).precision(8).required(),
                            latitude: Joi.number().min(-85.05112878).max(85.05112878).precision(8).required(),
                        }).id('BloodDonorCoordinateRequest').label('BloodDonorCoordinateRequest'),
                    }
                },
                async handler(request, h) {
                    const userId = request.auth.credentials.user_id as string;

                    try {
                        await bloodDonorService.updatePosition(userId, request.payload as any);

                        return h.response().code(204);
                    } catch (error: any) {
                        logger.error(error);

                        if (WithApplication.ERROR_NOT_FOUND === error.name) {
                            return h.response().code(404);
                        }

                        throw error;
                    }
                }
            },
        ])
    );
