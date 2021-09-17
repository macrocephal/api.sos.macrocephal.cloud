import { Server } from '@hapi/hapi';
import faker from 'faker';
// @ts-ignore
import * as GeoDistance from 'geo-distance';
import { Redis } from 'ioredis';
import Joi from 'joi';
import { v4 } from 'uuid';
import { APPLICATION_MATCH_LIMIT } from '../../../src/conf/create-env';
import { Client } from './../../../src/app/model/client';
import { Dispatch } from './../../../src/app/model/dispatch';
import { Request } from './../../../src/app/model/request';
import { User } from './../../../src/app/model/user';
import { app } from './../../../src/conf/app';
import { REDIS_TOKEN } from './../../../src/conf/create-redis';
import { SERVER_TOKEN } from './../../../src/conf/create-server';

describe( '/dispatches/{id}/matches', () => {
    beforeEach( async () => {
        const requester = [
            faker.address.latitude( 85.05112878, -85.05112878, 8 ),
            faker.address.longitude( 180, -180, 8 ),
        ] as const;
        const kinds = [ 'BLOOD', 'KIDNEY', 'LUNG' ].sort( Math.random );

        ( [ redis, server ] = await ( await app() )
            .register( APPLICATION_MATCH_LIMIT, () => 30 )
            .inject( REDIS_TOKEN, SERVER_TOKEN ) );
        await new Promise( resolve => setTimeout( resolve, 1 ) );

        await server.initialize();
        await redis.flushdb();

        // Record users
        users = await Promise.all( [ ...Array( 10 ) ].map( () => server.inject( {
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/users', payload: {
                email: faker.internet.email(),
            },
        } ).then( ( { result } ) => result as User ) ) );
        // Record clients
        clients = await Promise.all( [ ...Array( 3 * users.length ) ].map( () => server.inject( {
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/clients', payload: {
                userId: users[ Math.floor( users.length * Math.random() ) ]?.id,
                userAgent: faker.internet.userAgent(),
            },
        } ).then( ( { result } ) => result as Client ) ) );
        // Record candidacies
        requesterIndex = Math.round( clients.length * Math.random() );
        await Promise.all( clients.map( ( { id: clientId }, index ) => {
            const forceful = index === requesterIndex || 0 === index % 6;
            return server.inject( {
                headers: { contentType: 'application/json' },
                method: 'POST', url: `/clients/${ clientId }/candidacies`, payload: {
                    kind: kinds[ forceful ? 0 : faker.datatype.number( { min: 1, max: 2 } ) ],
                    enabled: true,
                },
            } );
        } ) );
        kind = kinds[ 0 ]!;
        // Record positions - fix a center, every other index%3 is enforced within vicinity
        radiusKilometers = 1 + Math.round( 999 * Math.random() );
        await Promise.all( clients.map( ( { id: clientId }, index ) => {
            if ( index === requesterIndex ) {
                return [ clientId, requester ] as const;
            } else if ( 0 === index % 3 ) {
                let vicinity: [ number, number ];

                do {
                    vicinity = faker.address.nearbyGPSCoordinate(
                        [ requester[ 0 ], requester[ 1 ] ],
                        Math.round( radiusKilometers * Math.random() ),
                        true ) as any;
                } while (
                    Joi.number().min( -180 ).max( 180 ).precision( 8 ).required().validate( vicinity[ 1 ] ).error ||
                    Joi.number().min( -85.05112878 ).max( 85.05112878 ).precision( 8 ).required().validate( vicinity[ 0 ] ).error );

                return [ clientId, vicinity ] as const;
            } else {
                return [ clientId, [
                    faker.address.latitude( 85.05112878, -85.05112878, 8 ),
                    faker.address.longitude( 180, -180, 8 ),
                ] ] as const;
            }
        } ).map( ( [ clientId, [ latitude, longitude ] ] ) => server.inject( {
            method: 'POST', url: `/clients/${ clientId }/position`,
            headers: { contentType: 'application/json' },
            payload: { latitude, longitude },
        } ) ) );
        // Send a request
        request = ( await server.inject( {
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/requests', payload: {
                clientId: clients[ requesterIndex ]!.id,
                radius: `${ radiusKilometers }km`,
                kind,
            },
        } ) ).result as any;
    } );
    afterEach( async () => {
        await redis.flushall();
        await redis.disconnect( false );
        await server.stop();
    } );

    let radiusKilometers: number;
    let requesterIndex: number;
    let clients: Client[];
    let request: Request;
    let users: User[];
    let kind: string;

    let server: Server;
    let redis: Redis;

    it( '-- just calling POST /dispatch should create matches', async () => {
        const expected = [ ...Array( clients.length ) ].map( ( _, i ) => i )
            // the client indexes we expect
            .filter( i => i === requesterIndex || 0 === i % 6 )
            .map( i => clients[ i ]?.userId! )
            .filter( ( userId, index, userIds ) =>
                // we dedupe userIds
                index === userIds.indexOf( userId ) &&
                // but also remove requester userId
                userId !== clients[ requesterIndex ]?.userId,
            );
        const { result, statusCode } = await server.inject( {
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/dispatches', payload: {
                requestId: request.id,
            },
        } );
        const matches = await redis.zrangebyscore( `data:match:${ ( result as any ).id }`, '-inf', '+inf' );

        expect( statusCode ).toBe( 201 );
        expect( matches.sort() ).toEqual( expected.sort() );
    } );

    it( 'GET -> HTTP 200', async () => {
        const count = [ ...Array( clients.length ) ].map( ( _, i ) => i )
            // the client indexes we expect
            .filter( i => i === requesterIndex || 0 === i % 6 )
            .map( i => clients[ i ]?.userId! )
            .filter( ( userId, index, userIds ) =>
                // we dedupe userIds
                index === userIds.indexOf( userId ) &&
                // but also remove requester userId
                userId !== clients[ requesterIndex ]?.userId,
            ).length;
        const { id: dispatchId } = ( await server.inject( {
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/dispatches', payload: {
                requestId: request.id,
            },
        } ) ).result as any as Dispatch;
        const { result, statusCode } = await server.inject( {
            method: 'GET', url: `/dispatches/${ dispatchId }/matches`,
            headers: { contentType: 'application/json' },
        } );

        expect( statusCode ).toBe( 200 );
        expect( result ).toEqual( { count } );
    } );

    it( 'GET -> HTTP 404', async () => {
        await server.inject( {
            headers: { contentType: 'application/json' },
            method: 'POST', url: '/dispatches', payload: {
                requestId: request.id,
            },
        } );
        const { result, statusCode } = await server.inject( {
            method: 'GET', url: `/dispatches/${ v4() }/matches`,
            headers: { contentType: 'application/json' },
        } );

        expect( statusCode ).toBe( 404 );
        expect( result ).toEqual( null as never );
    } );
} );
