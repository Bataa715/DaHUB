// NestJS decorators rely on Reflect.defineMetadata — load the polyfill before
// any service file (which use @Injectable/@Cron) is imported by a test.
import "reflect-metadata";
