import Joi from 'joi';
import { FIREBASE_APP_TOKEN } from '../../../conf/create-firebase-app';
import { REDIS_TOKEN } from './../../../conf/create-redis';
import { SERVER_TOKEN } from './../../../conf/create-server';
import { FIREBASE_STRATEGY } from './../../../conf/create-server-plugin';
import { Container } from './../../../container';
import { BloodDonor } from './../../model/blood-donor';
import { Position } from './../../model/position';
import { Logger } from './../../service/logger';
import { CREATED, UNAUTHORIZED_ERROR, UPDATED, VALIDATION_ERRORS } from './../util.schema';

export const bloodDonors: Container.Visitor = container => container
    .inject(Logger, REDIS_TOKEN, SERVER_TOKEN, FIREBASE_APP_TOKEN)
    .then(([logger, redis, server, app]) => {
        const donorsCollection = app.firestore().collection('donors:blood')
            .withConverter<BloodDonor>({
                fromFirestore: snapshot => snapshot.data() as BloodDonor,
                toFirestore: model => model,
            });

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
                    const donor = { ...request.payload as object, createdAt: Date.now(), id: userId } as BloodDonor;
                    logger.debug('[%s] POST /donors/blood | donor=', userId, donor);

                    await Promise.all([
                        // Persist to Firebase
                        donorsCollection.doc(userId).set(donor, { merge: false }),
                        // Organize facetet search into REDIS
                        redis.sadd(`donors:blood:group:${donor.bloodGroup}`, userId),
                        donor.rhesusFactor
                            ? redis.sadd(`donors:blood:rhesus:${donor.rhesusFactor}`, userId)
                            : Promise.resolve(0),
                    ]);
                    logger.debug('[%s] Blood donor /%s/ created!', userId, donor.id, donor);

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
                                rhesusFactor: Joi.valid('+', '-', null).required(),
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
                    const donorRef = donorsCollection.doc(userId);
                    const donor = (await donorRef.get()).data();
                    logger.debug('[%s] PUT /donors/blood | donor=', userId, donor);

                    if (!donor) return h.response().code(404);

                    const target = { ...donor, ...request.payload as object, updatedAt: Date.now() } as BloodDonor;

                    // Unset Redis faceting
                    await Promise.all([
                        redis.srem(`donors:blood:group:${donor.bloodGroup}`, userId),
                        donor.rhesusFactor
                            ? redis.srem(`donors:blood:rhesus:${donor.rhesusFactor}`, userId)
                            : Promise.resolve(0),
                    ]);
                    await Promise.all([
                        // Persist to Firebase
                        donorsCollection.doc(userId).set(target, { merge: false }),
                        // Organize facetet search into REDIS
                        redis.sadd(`donors:blood:group:${target.bloodGroup}`, userId),
                        target.rhesusFactor
                            ? redis.sadd(`donors:blood:rhesus:${target.rhesusFactor}`, userId)
                            : Promise.resolve(0),
                    ]);
                    logger.debug('[%s] Blood donor /%s/ updated!', userId, donor.id, target);

                    return h.response(target).code(200);
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
                    const donor = (await donorsCollection.doc(userId).get()).data();
                    logger.debug('[%s] DELETE /donors/blood | donor=', userId, donor);

                    if (!donor) return h.response().code(404);

                    await Promise.all([
                        // unpersist from Firebase
                        donorsCollection.doc(userId).delete(),
                        // Unset Redis faceting
                        redis.srem('donors:blood:coordinates', userId),
                        redis.srem(`donors:blood:group:${donor.bloodGroup}`, userId),
                        donor.rhesusFactor
                            ? redis.srem(`donors:blood:rhesus:${donor.rhesusFactor}`, userId)
                            : Promise.resolve(0),
                    ]);
                    logger.debug('[%s] Blood donor /%s/ deleted!', userId, donor.id);

                    return h.response().code(204);
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
                    const { longitude, latitude } = request.payload as Position;
                    const donor = (await donorsCollection.doc(userId).get()).data();
                    logger.debug('[%s] PUT /donors/blood/position | position=', userId, request.payload);

                    if (!donor) return h.response().code(404);

                    await redis.geoadd('donors:blood:coordinates', longitude, latitude, userId);
                    logger.debug('[%s] Blood donor /%s/ position updated!', userId, donor.id, request.payload);

                    return h.response().code(204);
                }
            },
        ]);
    });
