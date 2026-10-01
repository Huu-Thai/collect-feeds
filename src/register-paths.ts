import { join } from 'path';
import { register } from 'tsconfig-paths';

/**
 * Registers the `@common/*`, `@modules/*`, ... aliases for the COMPILED
 * output. `nest build`/`nest start` only resolve these via tsc's type
 * checker, not at runtime — this patches Node's module resolution so
 * `dist/src/**` can still require them. Must be the first import in
 * main.ts so it runs before anything else is required.
 */
register({
  baseUrl: join(__dirname, '..'),
  paths: {
    '@common/*': ['src/common/*'],
    '@config/*': ['src/config/*'],
    '@database/*': ['src/database/*'],
    '@cache/*': ['src/cache/*'],
    '@health/*': ['src/health/*'],
    '@modules/*': ['src/modules/*'],
    '@email/*': ['src/email/*'],
  },
});
