import { debug, Debugger } from 'debug';

export class Logger {
    #namespace = '<[not-resolved]>';

    constructor(namespace: string);
    constructor(namespaceResolver: (() => string) | (() => Promise<string>));
    constructor(namespaceOrNamespaceResolver: string | (() => string) | (() => Promise<string>)) {
        if ('string' === typeof namespaceOrNamespaceResolver) {
            this.#namespace = namespaceOrNamespaceResolver;
        } else {
            Promise.resolve(namespaceOrNamespaceResolver()).then(namespace => this.#namespace = namespace);
        }
    }

    log(...args: Parameters<Debugger>) {
        this.#debuggerFactory('log')(...args);
    }

    info(...args: Parameters<Debugger>) {
        this.#debuggerFactory('info')(...args);
    }

    warn(...args: Parameters<Debugger>) {
        this.#debuggerFactory('warn')(...args);
    }

    debug(...args: Parameters<Debugger>) {
        this.#debuggerFactory('debug')(...args);
    }

    error(...args: Parameters<Debugger>) {
        this.#debuggerFactory('error')(...args);
    }

    fatal(...args: Parameters<Debugger>) {
        this.#debuggerFactory('fatal')(...args);
    }

    trace(...args: Parameters<Debugger>) {
        this.#debuggerFactory('trace')(...args);
    }

    level(level: 'log' | 'info' | 'warn' | 'debug' | 'error' | 'fatal' | 'trace') {
        return this[level].bind(this);
    }

    #debuggerFactory(level: Parameters<Logger['level']>[0]): Debugger {
        let path = [...new Error().stack!.matchAll(/\((.*)\.[tj]s(?::\d+){2}\)/g)]
            .find(([, target], _i, matches) => target !== matches[0]?.[1])
            ?.[1]
            ?.replace(/^webpack:\/\/[^\/\\]+[\/\\](.*)$/, '$1');
        path = path?.startsWith(process.cwd()) ? path.split(process.cwd())?.[1]?.substr(1) : path;

        return debug(`${this.#namespace}:${path}:${level}`);
    }
}
