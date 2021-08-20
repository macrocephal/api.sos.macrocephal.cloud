import { SERVER_TOKEN } from '../../conf/create-server';
import { Container } from '../../container';

export const dispatches: Container.Visitor = container =>
    container.inject(SERVER_TOKEN).then(([server]) => server.route({
        method: 'POST',
        path: '/dispatches',
        handler(request, h) {
            return h.response({
                url: request.url,
                method: request.method,
            });
        }
    }));