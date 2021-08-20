import { debug, Debugger } from 'debug';
import { APPLICATION_NAME } from './../../conf/create-env';
import { Container } from './../../container';

export class Logger {
    readonly #matcher = /Error\s+at[^\n]+\n\s+at \S+ \(.*\/src\/(.*)\.[tj]s:\d+:\d+\)/;
    #prefixResolver: (file: string | undefined) => string;

    constructor(containerOrNamespace: Container | string) {
        if ('string' === typeof containerOrNamespace) {
            this.#prefixResolver = () => containerOrNamespace;
        } else {
            let namespace: string;
            const getNamespace = () => namespace;

            containerOrNamespace.inject(APPLICATION_NAME).then(([ns]) => namespace = ns);
            this.#prefixResolver = file => `${getNamespace()}:src/${file}`;
        }
    }

    get log(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:log`);
    }

    get info(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:info`);
    }

    get warn(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:warn`);
    }

    get debug(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:debug`);
    }

    get error(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:error`);
    }

    get fatal(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:fatal`);
    }

    get trace(): Debugger {
        const file = new Error().stack?.match(this.#matcher)?.[1];
        return debug(`${this.#prefixResolver(file)}:trace`);
    }

    level(level: 'log' | 'info' | 'warn' | 'debug' | 'error' | 'fatal' | 'trace') {
        return this[level];
    }
}
