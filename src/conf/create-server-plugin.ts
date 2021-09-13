import { Plugin } from '@hapi/hapi';
import * as inert from '@hapi/inert';
import * as vision from '@hapi/vision';
import { unauthorized } from 'boom';
import { app } from 'firebase-admin';
import * as hapiswagger from 'hapi-swagger';
import { Logger } from './../app/service/logger';
import { Container } from './../container';
import { APPLICATION_AUTHOR, APPLICATION_DESCRIPTION, APPLICATION_LICENSE, APPLICATION_NAME, APPLICATION_VERSION } from './create-env';
import { FIREBASE_APP_TOKEN } from './create-firebase-app';
import { SERVER_TOKEN } from './create-server';

export const FIREBASE_SCHEME = 'FIREBASE';
export const FIREBASE_STRATEGY = 'FIREBASE_STRATEGY';

export const createServerPlugin: Container.Visitor = container =>
    container.inject(Logger, SERVER_TOKEN, APPLICATION_NAME, APPLICATION_AUTHOR,
        APPLICATION_LICENSE, APPLICATION_VERSION, APPLICATION_DESCRIPTION, FIREBASE_APP_TOKEN,
    ).then(([logger, server, appName, appAuthor, appLicense, appVersion, appDescription, firebaseApplication]) => server.register([
        { plugin: inert },
        { plugin: vision },
        {
            plugin: hapiswagger,
            options: {
                tags: [
                    { name: 'dispatches' },
                    { name: 'requests' },
                    { name: 'clients' },
                    { name: 'users' },
                ],
                documentationPath: '/',
                jsonPath: `/${appName}.json`,
                info: {
                    title: appName,
                    version: appVersion,
                    description: appDescription,
                    license: {
                        name: appLicense,
                        url: `https://github.com/macrocephal/${appName}/blob/main/LICENSE`
                    },
                    contact: {
                        name: appAuthor.split(' <')[0],
                        email: appAuthor.replace(/.*<(.*)>/, '$1'),
                    },
                },
            } as hapiswagger.RegisterOptions
        },
        {
            plugin: {
                register(server, { app, logger }) {
                    server.auth.scheme(FIREBASE_SCHEME, () => ({
                        async authenticate(request, h) {
                            const token = request.headers.authorization?.match(/(bearer)[ ]+(.*)/i)?.[2];

                            if (token) {
                                try {
                                    const credentials = await app.auth().verifyIdToken(token, true);

                                    return h.authenticated({ credentials });
                                } catch (error) {
                                    logger.error(error);
                                }
                            }

                            throw unauthorized(`Invalid token: ${token}`, FIREBASE_SCHEME);
                        }
                    }));
                    server.auth.strategy(FIREBASE_STRATEGY, FIREBASE_SCHEME);
                },
                name: FIREBASE_SCHEME,
                once: true,
            } as Plugin<{ app: app.App, logger: Logger }>,
            options: {
                logger,
                app: firebaseApplication,
            },
        },
    ])).catch(async error => {
        const [logger] = await container.inject(Logger);

        logger.error('', error);

        throw error;
    });
