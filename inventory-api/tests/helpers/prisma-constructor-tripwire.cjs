'use strict';

const Module = require('node:module');

const originalLoad = Module._load;

Module._load = function loadWithPrismaConstructorTripwire(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (request !== '@prisma/client') return loaded;

  return new Proxy(loaded, {
    get(target, property, receiver) {
      if (property !== 'PrismaClient') return Reflect.get(target, property, receiver);
      return class PrismaConstructorTripwire {
        constructor() {
          throw new Error('WAVE9_PRISMA_CONSTRUCTOR_TRIPWIRE_REACHED');
        }
      };
    },
  });
};
