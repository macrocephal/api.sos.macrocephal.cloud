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
    #factories = new Map<Token<any>, Container.Factory<any>>();

    static #isToken(token: any): token is Token<any> {
        return 'symbol' === typeof token;
    }

    register<T>(token: Constructor<T>): this;
    register<T>(token: Token<T>, factory: Container.Factory<T>): this;
    register<T>(token: Constructor<T>, value: any): this;
    register<T>(token: Token<T> | Constructor<T>, factoryOrValue?: any): this {
        if (Container.#isToken(token)) {
            this.#factories.set(token, factoryOrValue!);
        } else if (1 < arguments.length) {
            this.#values.set(token, factoryOrValue);
        } else {
            this.#constructors.add(token);
        }

        return this;
    }

    visit(...visitors: Container.Visitor[]): this {
        for (const visitor of visitors) {
            visitor(this);
        }

        return this;
    }

    async inject<TS extends (Token<any> | Constructor)[]>(...tokens: TS): Promise<{
        [K in keyof TS]: TS[K] extends Token<infer TT>
        ? TT extends Promise<infer T>
        ? T
        : TT
        : TS[K] extends Constructor<infer CT>
        ? CT extends Promise<infer T>
        ? T
        : CT
        : never;
    }> {
        const values: any[] = [];

        for (const token of tokens) {
            if (this.#values.has(token)) {
                values.push(this.#values.get(token));
            } else if (Container.#isToken(token) && this.#factories.has(token)) {
                try {
                    // NOTE: catch exception for sync & async factory
                    const value = await this.#factories.get(token)!(this);

                    values.push(this.#values.set(token, value).get(token));
                    this.#values.set(token, value);
                } catch (error) {
                    throw new Container.TargetComputeError(token, error);
                }
            } else if (!Container.#isToken(token)) {
                if (!this.#constructors.has(token)) {
                    throw new Container.TargetNotFound(token);
                }

                try {
                    // NOTE: catch exception for sync & async factory
                    const value = Reflect.construct(token, [this]);

                    values.push(this.#values.set(token, value).get(token));
                    this.#values.set(token, value);
                } catch (error) {
                    throw new Container.TargetComputeError(token, error);
                }
            } else {
                throw new Container.TargetNotFound(token);
            }
        }

        return values as any;
    }

    static TargetComputeError = class TargetNotFound extends Error {
        constructor(token: Token<any> | Constructor, public readonly cause: any) {
            super(`Could not resolve target value from Container: ${token.toString()}`);
        }
    };

    static TargetNotFound = class TargetNotFound extends Error {
        constructor(token: Token<any> | Constructor) {
            super(`Could not resolve target value from Container: ${token.toString()}`);
        }
    };
}

export namespace Container {
    export interface Factory<T> {
        (container: Container): T | Promise<T>;
    }

    export interface Visitor {
        (host: Container): any;
    }
}
