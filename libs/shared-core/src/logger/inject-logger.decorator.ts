import { Logger as NestLogger } from '@nestjs/common';

export type Logger = NestLogger;

const loggersByClass = new WeakMap<object, NestLogger>();

// One logger per class, created on first use. The context is the name of the class of the instance, so a subclass gets its own context.
function loggerOf(instance: object): NestLogger {
  const ownClass = instance.constructor;
  const cached = loggersByClass.get(ownClass);
  if (cached) {
    return cached;
  }
  const created = new NestLogger(ownClass.name);
  loggersByClass.set(ownClass, created);
  return created;
}

// `@InjectLogger() private declare readonly logger: Logger;`
// The field needs `declare`: with ES2022 and later, a normal class field is defined on the instance and hides the getter this decorator puts on the prototype.
export function InjectLogger(): PropertyDecorator {
  return function defineLoggerGetter(target: object, propertyKey: string | symbol): void {
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      get(this: object): NestLogger {
        return loggerOf(this);
      },
    });
  };
}
