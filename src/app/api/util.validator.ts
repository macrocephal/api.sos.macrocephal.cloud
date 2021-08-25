import { RequestService } from './../service/request.service';
import Joi, { ExternalValidationFunction } from 'joi';
import { Container } from './../../container';
import { ClientService } from './../service/client.service';
import { UserService } from './../service/user.service';

export const userIdExists = (container: Container, optional = false): ExternalValidationFunction =>
    async userId => {
        if (optional && void 0 === userId) return;

        const [userService] = await container.inject(UserService);

        if (!await userService.exists(userId)) {
            throw new Joi.ValidationError('userId.notFound', [{
                message: '"userId" does not exists',
                type: 'userId.notFound',
                path: ["userId"],
                context: {
                    value: userId,
                    label: 'userId',
                    key: 'userId',
                },
            }], userId);
        }
    };

export const clientIdExists = (container: Container, optional = false): ExternalValidationFunction =>
    async clientId => {
        if (optional && void 0 === clientId) return;

        const [clientService] = await container.inject(ClientService);

        if (!await clientService.exists(clientId)) {
            throw new Joi.ValidationError('clientId.notFound', [{
                message: '"clientId" does not exists',
                type: 'clientId.notFound',
                path: ["clientId"],
                context: {
                    value: clientId,
                    label: 'clientId',
                    key: 'clientId',
                },
            }], clientId);
        }
    };

export const requestIdExists = (container: Container, optional = false): ExternalValidationFunction =>
    async requestId => {
        if (optional && void 0 === requestId) return;

        const [requestService] = await container.inject(RequestService);

        if (!await requestService.exists(requestId)) {
            throw new Joi.ValidationError('requestId.notFound', [{
                message: '"requestId" does not exists',
                type: 'requestId.notFound',
                path: ["requestId"],
                context: {
                    value: requestId,
                    label: 'requestId',
                    key: 'requestId',
                },
            }], requestId);
        }
    };
