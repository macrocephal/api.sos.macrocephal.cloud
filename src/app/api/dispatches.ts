import Joi, { StringSchema } from 'joi';
import { v4 } from 'uuid';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { Dispatch } from '../model/dispatch';
import { execMatchOutcome } from '../script/exec-match-outcome';
import { execMatch } from './../script/exec-match';
import { ClientService } from './../service/client.service';
import { DispatchService } from './../service/dispatch.service';
import { RequestService } from './../service/request.service';
import { CREATED, ID, radius, RADIUS, recycled, VALIDATION_ERRORS } from './util.schema';
import { requestIdExists } from './util.validator';

export const dispatches: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route([
        {
            method: 'POST',
            path: '/dispatches',
            options: {
                tags: ['api', 'dispatches'],
                description: `Create a request's dispatch`,
                response: {
                    status: {
                        201: Joi.object({
                            ...CREATED,
                            requestId: ID.id,
                            ...RADIUS,
                        }).id('DispatchCreated').label('DispatchCreated'),
                        409: Joi.valid().required(),
                        422: VALIDATION_ERRORS,
                    },
                },
                validate: {
                    payload: Joi.object({
                        requestId: (ID.id as StringSchema).concat(
                            Joi.string().external(requestIdExists(container))
                        ),
                        ...radius,
                    }).label('DispatchCreateRequest'),
                },
            },
            async handler(request, h) {
                const [dispatchService, requestService] = await container
                    .inject(DispatchService, RequestService, ClientService);
                const payload: Dispatch & Partial<Pick<Dispatch, 'requestId'>> = request.payload as any;
                const { kind: requestKind, radius, clientId } = await requestService.search(payload.requestId);
                const dispatch = await dispatchService.create({
                    ...payload,
                    ...payload.radius ? {} : { radius },
                    id: v4(),
                } as never) ?? {};

                if (dispatch) {
                    await execMatch({
                        requestKind, container, clientId,
                        dispatchId: dispatch.id,
                        radius: dispatch.radius,
                    });

                    return h.response(dispatch).code(201);
                } else {
                    return h.response().code(404);
                }
            },
        },
        // NOTE: need not to PUT dispatches
        // NOTE: need not to PATCH dispatches
        {
            method: 'GET',
            path: '/dispatches/{id}',
            options: {
                tags: ['api', 'dispatches'],
                description: `Get a request's dispatch`,
                response: {
                    status: {
                        200: Joi.object({
                            ...recycled,
                            requestId: ID.id,
                            ...RADIUS,
                        }).id('DispatchRecorded').label('DispatchRecorded'),
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
                const [dispatchService] = await container.inject(DispatchService);
                const dispatch = await dispatchService.search(request.params.id);

                return dispatch ? h.response(dispatch).code(200) : h.response().code(404);
            },
        },
        // NOTE: need not to DELETE dispatches
        {
            method: 'GET',
            path: '/dispatches/{id}/matches',
            options: {
                tags: ['api', 'dispatches'],
                description: `Get a request's dispatch matches/outcome`,
                response: {
                    status: {
                        200: Joi.object({
                            count: Joi.number().precision(0).required(),
                        }).id('DispatchOutcome').label('DispatchOutcome')
                            .description('Number of matches for dispatch which ID is provided.'),
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
                const count = await execMatchOutcome({
                    dispatchId: request.params.id,
                    container,
                });

                return 0 > count ? h.response().code(404) : h.response({ count }).code(200);
            },
        },
    ]));
