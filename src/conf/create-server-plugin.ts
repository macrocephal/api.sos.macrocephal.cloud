import * as inert from '@hapi/inert';
import * as vision from '@hapi/vision';
import * as hapiswagger from 'hapi-swagger';
import { Container } from './../container';
import { APPLICATION_AUTHOR, APPLICATION_DESCRIPTION, APPLICATION_LICENSE, APPLICATION_NAME, APPLICATION_VERSION } from './create-env';
import { SERVER_TOKEN } from './create-server';

export const createServerPlugin: Container.Visitor = container => container
    .inject(SERVER_TOKEN, APPLICATION_NAME, APPLICATION_AUTHOR, APPLICATION_LICENSE, APPLICATION_VERSION, APPLICATION_DESCRIPTION)
    .then(([server, appName, appAuthor, appLicense, appVersion, appDescription]) => console.log({appLicense}) as any || server.register([
        { plugin: inert },
        { plugin: vision },
        {
            plugin: hapiswagger,
            options: {
                tags: [
                    { name: 'dispatches' },
                    { name: 'requests' },
                    { name: 'clients' },
                    { name: 'matches' },
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
        }
    ]));
