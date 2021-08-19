/**
 *
 * @since Aug 18, 2021 @t 15:25:10
 * @author Salathiel &lt;salathiel@genese.name&gt;
 *
 */
import { Constructor } from '@squall.io/types';

export class Container {
    #constructors = new Set<Constructor>();
    #values = new Map<Token<any> | Constructor, any>();
    #factories = new Map<Token<any>, ValueFactory<any>>();

    static #isToken( token: any ): token is Token<any> {
        return 'symbol' === typeof token;
    }

    register<T>( token: Constructor<T> ): this;
    register<T>( token: Token<T>, factory: ValueFactory<T> ): this;
    register<T>( token: Constructor<T>, value: any ): this;
    register<T>( token: Token<T> | Constructor<T>, factoryOrValue?: any ): this {
        if ( Container.#isToken( token ) ) {
            this.#factories.set( token, factoryOrValue! );
        } else if ( 1 < arguments.length ) {
            this.#values.set( token, factoryOrValue );
        } else {
            this.#constructors.add( token );
        }

        return this;
    }

    async inject<T>( token: Token<T> ): Promise<T>;
    async inject<T>( token: Constructor<T> ): Promise<T>;
    async inject<T>( token: Token<T> | Constructor<T> ): Promise<T> {
        if ( this.#values.has( token ) ) {
            return this.#values.get( token );
        } else if ( Container.#isToken( token ) && this.#factories.has( token ) ) {
            try {
                // NOTE: catch exception for sync & async factory
                return await this.#factories.get( token )!( this );
            } catch ( error ) {
                throw new Container.TargetComputeError( token, error );
            }
        } else if ( !Container.#isToken( token ) ) {
            try {
                // NOTE: catch exception for sync & async factory
                return this.#values.set( token, Reflect.construct( token, [ this ] ) ).get( token );
            } catch ( error ) {
                throw new Container.TargetComputeError( token, error );
            }
        } else {
            throw new Container.TargetNotFound( token );
        }
    }

    static TargetComputeError = class TargetNotFound extends Error {
        constructor( token: Token<any> | Constructor, public readonly cause: any ) {
            super( `Could not resolve target value from Container: ${ token.toString() }` );
        }
    };

    static TargetNotFound = class TargetNotFound extends Error {
        constructor( token: Token<any> | Constructor ) {
            super( `Could not resolve target value from Container: ${ token.toString() }` );
        }
    };
}

export interface ValueFactory<T> {
    ( container: Container ): T | Promise<T>;
}
