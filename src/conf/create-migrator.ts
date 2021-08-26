import { Redis } from 'ioredis';
import { Logger } from './../app/service/logger';
import { Container } from './../container';
import { APPLICATION_MIGRATION_VERSION_KEY } from './create-env';
import { REDIS_TOKEN } from './create-redis';

export const MIGRATOR_TOKEN: Token<() => Promise<void>> = Symbol('Migrator token');

export const createMigrator: Container.Visitor = container =>
    container.register(MIGRATOR_TOKEN, () => async () => {
        const [redis, logger, key] = await container.inject(REDIS_TOKEN, Logger, APPLICATION_MIGRATION_VERSION_KEY);
        const version = +(await redis.get(key))! || 0;
        const versions = Object.keys(migrations)
            .map(key => +key)
            .filter(versionId => versionId > version)
            .map(key => [+key, migrations[key]!] as const)
            .sort(([a], [b]) => a - b)
            ;

        if (!versions.length) {
            logger.debug(`No migration to apply - version:${version} (${migrations[version]?.description})`);
            return;
        }

        logger.debug(`Starting migration - version:${version}`);

        for (const [version, { description, runner }] of versions) {
            logger.debug(`Running migration - version:${version} (${description})`);

            try {
                await runner(redis);
                logger.debug(` MigrationSuccess - version:${version} (${description})`);
            } catch (error) {
                logger.debug(`   MigrationError - version:${version} (${description})`);
                logger.error(error);
                throw error;
            }
        }
    });

const migrations: Record<number, { description: string, runner: (redis: Redis) => Promise<void> }> = {
    1629910336684: {
        description: "init",
        async runner(redis) {
            await redis.send_command('FT.CREATE', 'index:client', 'ON', 'HASH', 'PREFIX', '1', 'data:client:', 'SCHEMA', 'id', 'NUMERIC', 'SORTABLE', 'userId', 'NUMERIC', 'SORTABLE');
        }
    },
};
