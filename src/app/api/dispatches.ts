import Joi, { StringSchema } from 'joi';
import { v4 } from 'uuid';
import { APPLICATION_MATCH_LIMIT } from '../../conf/create-env';
import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';
import { Dispatch } from '../model/dispatch';
import { REDIS_TOKEN } from './../../conf/create-redis';
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
                tags: ['api'],
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
                const [redis, count, dispatchService, requestService, clientService] = await container
                    .inject(REDIS_TOKEN, APPLICATION_MATCH_LIMIT, DispatchService, RequestService, ClientService);
                const payload: Dispatch & Partial<Pick<Dispatch, 'requestId'>> = request.payload as any;
                const $request = await requestService.search(payload.requestId);
                const dispatch = await dispatchService.create({
                    ...payload,
                    ...payload.radius ? {} : { radius: $request.radius },
                    id: v4(),
                } as never) ?? {};

                if (dispatch) {
                    const { id: clientId, userId } = await clientService.search($request.clientId);
                    const unit = dispatch.radius.split(/^\d+(\.\d+)?/)[2]!;
                    const radius = +dispatch.radius.split(unit)[0]!;

                    await redis.eval(
                        `-- Of all the clients in the vicinity
                        redis.call('GEORADIUSBYMEMBER', KEYS[1], ARGV[1], ARGV[2], ARGV[3], 'ASC', 'STOREDIST', 'tmp:match:vicinity-clients');

                        -- Map clientIds to userIds set
                        for _, clientId in ipairs( redis.call('ZRANGEBYSCORE', 'tmp:match:vicinity-clients', '-inf', '+inf') ) do
                            for _, userId in ipairs( redis.call('SMEMBERS', 'data:client-users:' .. clientId) ) do
                                redis.call('ZADD', 'tmp:match:vicinity-users', 0, userId);
                            end
                        end

                        -- Intersect users with their candidacies
                        redis.call('ZINTERSTORE', KEYS[2], 2, KEYS[3], 'tmp:match:vicinity-users', 'WEIGHTS', 0, 1);

                        -- Remove self
                        redis.call('ZREM', KEYS[2], ARGV[4]);

                        -- Prune
                        redis.call('ZREMRANGEBYRANK', KEYS[2], ARGV[5], 1000000000);

                        -- Clean up
                        redis.call('DEL', 'tmp:match:vicinity-users', 'tmp:match:vicinity-clients');`,
                        3, 'data:positions', `data:match:${dispatch.id}`, `data:candidacies:${$request.kind}`,
                        clientId, radius, unit, userId, count);

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
                tags: ['api'],
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
                tags: ['api'],
                description: `Get a request's dispatch`,
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
                const [redis] = await container.inject(REDIS_TOKEN);
                const count = +await redis.eval(
                    `if 1 == redis.call('EXISTS', KEYS[1]) then
                        return redis.call('ZCARD', KEYS[1]);
                    end

                    return -1;`,
                    1, `data:match:${request.params.id}`);

                return 0 > count ? h.response().code(404) : h.response({ count }).code(200);
            },
        },
    ]));
