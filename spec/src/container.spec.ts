import { Container } from './../../src/container';

describe('Container', () => {
    beforeEach(() => {
        container = new Container();
        token = Symbol();
    });

    let container: Container;
    let token: Token<string>;

    // token

    it('should not execute factory at registration', () => {
        const spy = jasmine.createSpy();

        container.register(token, spy)
        expect(spy).not.toHaveBeenCalled();
    });

    it('should execute factory at injection', async () => {
        const spy = jasmine.createSpy();

        await container.register(token, spy).inject(token)
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute factory at first injection only', async () => {
        const spy = jasmine.createSpy();

        container.register(token, spy);
        await container.inject(token);
        await container.inject(token);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute factory at first injection only, with single parameter', async () => {
        const spy = jasmine.createSpy();

        container.register(token, spy);
        await container.inject(token);
        await container.inject(token);
        expect(spy.calls.first().args.length).toBe(1);
    });

    it('should execute factory at first injection only, with single parameter, the container', async () => {
        const spy = jasmine.createSpy();

        container.register(token, spy);
        await container.inject(token);
        await container.inject(token);
        expect(spy.calls.first().args[0]).toBe(container);
    });

    it('injection with token should return a promise', () => {
        container.register(token, () => Math.random().toString(36));
        expect(container.inject(token)).toBeInstanceOf(Promise);
    });

    it('injection with token should return a promise, resolved with injected value', async () => {
        const value = Math.random().toString(36);

        container.register(token, () => value);
        expect(await container.inject(token)).toEqual([value]);
    });

    it('injection with token should return a promise, failed with Container.TargetNotFound for unknown token', async () => {
        expect(await container.inject(token).catch(error => error)).toBeInstanceOf(Container.TargetNotFound);
    });

    it('injection with token should return a promise, failed with Container.TargetComputeError for error when computing the factory value', async () => {
        container.register(token, () => { throw new Error(`Blah, blah, blah...`) });
        expect(await container.inject(token).catch(error => error)).toBeInstanceOf(Container.TargetComputeError);
    });

    // class

    it('should not execute constructor at registration', () => {
        class Class {
            constructor() {
                spy(...arguments);
            }
        }
        const spy = jasmine.createSpy();

        container.register(Class)
        expect(spy).not.toHaveBeenCalled();
    });

    it('should execute constructor at injection', async () => {
        class Class {
            constructor() {
                spy(...arguments);
            }
        }
        const spy = jasmine.createSpy();

        await container.register(Class).inject(Class)
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute constructor at first injection only ', async () => {
        class Class {
            constructor() {
                spy(...arguments);
            }
        }
        const spy = jasmine.createSpy();

        container.register(Class);
        await container.inject(Class);
        await container.inject(Class);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute factory at first injection only, with single parameter', async () => {
        class Class {
            constructor() {
                spy(...arguments);
            }
        }
        const spy = jasmine.createSpy();

        container.register(Class);
        await container.inject(Class);
        await container.inject(Class);
        expect(spy.calls.first().args.length).toBe(1);
    });

    it('should execute factory at first injection only, with single parameter, the container', async () => {
        class Class {
            constructor() {
                spy(...arguments);
            }
        }
        const spy = jasmine.createSpy();

        container.register(Class);
        await container.inject(Class);
        await container.inject(Class);
        expect(spy.calls.first().args[0]).toBe(container);
    });

    it('injection with class should return a promise', () => {
        class Class { }
        container.register(Class);
        expect(container.inject(Class)).toBeInstanceOf(Promise);
    });

    it('injection with class should return a promise, resolved with injected value', async () => {
        class Class { }

        container.register(Class);
        expect((await container.inject(Class))[0]).toBeInstanceOf(Class);
    });

    it('injection with class should return a promise, failed with Container.TargetNotFound for unknown token', async () => {
        class Class {
            constructor() {
                throw new Error(`123`);
            }
        }
        expect(await container.inject(Class).catch(error => error)).toBeInstanceOf(Container.TargetNotFound);
    });

    it('injection with class should return a promise, failed with Container.TargetComputeError for error when creating the instance value', async () => {
        class Class {
            constructor() {
                throw new Error(`123`);
            }
        }
        container.register(Class);
        expect(await container.inject(Class).catch(error => error)).toBeInstanceOf(Container.TargetComputeError);
    });

    // class token

    it('injection with class token should return a promise', () => {
        /**
         * A constructor throwing exception sside test that it is never invoked
         */
        class Class {
            constructor() {
                throw new Error(`123`);
            }
        }
        container.register(Class, Math.random());
        expect(container.inject(Class)).toBeInstanceOf(Promise);
    });

    it('injection with class token should return a promise, resolved with registered value', async () => {
        /**
         * A constructor throwing exception sside test that it is never invoked
         */
        class Class {
            constructor() {
                throw new Error(`123`);
            }
        }
        const value = Math.random();

        container.register(Class, value);
        expect(await container.inject<any>(Class)).toEqual([value] as any);
    });
});
