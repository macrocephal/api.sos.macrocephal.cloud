import { BloodDispatchOutcomeKey, execBloodRequestDispatch } from '../../script/exec-blood-request-dispatch';
import Joi from 'joi';
import { v4 } from 'uuid';
import { FIREBASE_APP_TOKEN } from '../../../conf/create-firebase-app';
import { REDIS_TOKEN } from '../../../conf/create-redis';
import { SERVER_TOKEN } from '../../../conf/create-server';
import { FIREBASE_STRATEGY } from '../../../conf/create-server-plugin';
import { Container } from '../../../container';
import { BloodRequest } from '../../model/blood-request';
import { Logger } from '../../service/logger';
import { CREATED, ID, UNAUTHORIZED_ERROR, VALIDATION_ERRORS } from '../util.schema';

export const bloodRequesters: Container.Visitor = container => container
    .inject(Logger, REDIS_TOKEN, SERVER_TOKEN, FIREBASE_APP_TOKEN)
    .then(([logger, redis, server, app]) => {
        const bloodRequestsCollection = app.firestore().collection('donors:blood')
            .withConverter<BloodRequest>({
                fromFirestore: snapshot => snapshot.data() as BloodRequest,
                toFirestore: model => model,
            });

        server.route([
            {
                method: 'POST',
                path: '/requesters/blood',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'requesters:blood'],
                    description: 'Request a new blood donation',
                    response: {
                        status: {
                            201: Joi.object({
                                ...CREATED,
                                userId: Joi.string().required(),
                                activated: Joi.valid(true).required(),
                                rhesusFactor: Joi.valid('+', '-').required(),
                                bloodGroup: Joi.valid('A', 'B', 'AB', 'O').required(),
                            }).id('BloodRequestCreated').label('BloodRequestCreated'),
                            401: UNAUTHORIZED_ERROR,
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
                    const { rhesusFactor, bloodGroup, longitude, latitude } = request.payload as any;
                    const userId = request.auth.credentials.user_id as string;
                    const bloodRequest = {
                        createdAt: Date.now(),
                        activated: true,
                        rhesusFactor,
                        bloodGroup,
                        id: v4(),
                        userId,
                    } as BloodRequest;

                    // Persist to FireStore
                    await bloodRequestsCollection.doc(bloodRequest.id).set(bloodRequest, { merge: false });

                    // Run the first dispatch right after
                    const { statusCode, result } = await server.inject({
                        url: `/requesters/blood/${bloodRequest.id}/dispatch`,
                        headers: {
                            authorization: request.headers.authorization!,
                        },
                        payload: { longitude, latitude },
                        method: 'POST',
                    });

                    if (400 <= statusCode) {
                        await bloodRequestsCollection.doc(bloodRequest.id).delete();

                        return h.response(result).code(statusCode);
                    }

                    logger.debug('Blood Request "{}" created!', bloodRequest.id);
                    return h.response(bloodRequest).code(201);
                },
            },
            {
                method: 'POST',
                path: '/requesters/blood/{requestId}/dispatch',
                options: {
                    auth: FIREBASE_STRATEGY,
                    tags: ['api', 'requesters:blood'],
                    description: 'Dispatch a blood donation request',
                    response: {
                        status: {
                            204: Joi.valid().required(),
                            409: Joi.valid().required(),
                            401: UNAUTHORIZED_ERROR,
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
                    const requestId = request.params.requestId as string;
                    const userId = request.auth.credentials.user_id as string;
                    const bloodRequest = (await bloodRequestsCollection
                        .where('id', '==', requestId)
                        .where('userId', '==', userId)
                        .get()).docs[0]?.data();

                    if (!bloodRequest) return h.response().code(404);
                    if (!bloodRequest.activated) return h.response().code(409);

                    const { longitude, latitude } = request.payload as any;
                    const dispatchId = v4();
                    const outcome = await execBloodRequestDispatch({
                        rhesusFactor: bloodRequest.rhesusFactor,
                        bloodGroup: bloodRequest.bloodGroup,
                        requestId: bloodRequest.id,
                        dispatchId,
                        container,
                        longitude,
                        latitude,
                        userId,
                    });

                    for (const group of Object.keys(outcome) as BloodDispatchOutcomeKey[]) {
                        switch (group) {
                            case 'O:+':
                                break;
                            default:
                                throw new Error('not implemented error');
                        }
                    }

                    // TODO: Execute the dispatch into REDIS
                    // TODO: Persist matches for donors (BLOOD/conf - arounded distance)
                    // TODO: Persist matches for requesters

                    logger.debug('Blood Request "{}" dispatched "{}"!', bloodRequest.id, dispatchId);
                    return h.response().code(204);
                },
            },
        ]);
    })
