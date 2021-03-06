import { debug, Debugger } from 'debug';

export class Logger {
    #namespace = '<[not-resolved]>';

    constructor(namespace: string);
    constructor(namespaceResolver: (() => string | Promise<string>));
    constructor(namespaceOrResolver: string | (() => string | Promise<string>)) {
        if ('string' === typeof namespaceOrResolver) {
            this.#namespace = namespaceOrResolver;
        } else {
            (namespaceOrPromise => {
                if ('string' == typeof namespaceOrPromise) {
                    this.#namespace = namespaceOrPromise;
                } else {
                    namespaceOrPromise.then(namespace => this.#namespace = namespace);
                }
            })(namespaceOrResolver());
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
        let [, path, position] = [...new Error().stack!.matchAll(/\((.*)\.[tj]s:(\d+:\d+)\)/g)]
            .find(([, target], _i, matches) => target !== matches[0]?.[1]) ?? [];
        path = path?.replace(/^webpack:\/\/[^\/\\]+[\/\\](.*)$/, '$1');
        path = path?.startsWith(process.cwd()) ? path.split(process.cwd())?.[1]?.substr(1) : path;

        return ((first?: any, ...others: any[]) => {
            let initial: string[];

            // If first parameter is string, it might be a debugger template string
            if ('string' === typeof first) {
                initial = [`[${position}] ${first}`];
            } else {
                initial = [`[${position}]`, first];
            }

            debug(`${this.#namespace}:${path}:${level}`)
                (...initial as [string, string], ...others);
        }) as any;
    }
}
