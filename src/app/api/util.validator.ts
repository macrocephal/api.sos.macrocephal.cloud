import { ClientService } from './../service/client.service';
import Joi, { ExternalValidationFunction } from 'joi';
import { Container } from './../../container';
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
            }], userId)
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
            }], clientId)
        }
    };
