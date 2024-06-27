import type { PrismaClient } from '@prisma/client';
import type { BaileysEventEmitter, SocketConfig } from '@whiskeysockets/baileys';
import type { SessionOptions } from './session';
import { setLogger, setPrisma } from './shared';
import * as handlers from './storeHandlers';

type initStoreOptions = {
    /** Prisma client instance */
    prisma: PrismaClient;
    /** Baileys pino logger */
    logger?: SocketConfig['logger'];
};

/** Initialize shared instances that will be consumed by the Store instance */
export function initStore({ prisma, logger }: initStoreOptions) {
    setPrisma(prisma);
    setLogger(logger);
}

export class Store {
    private readonly chatHandler;
    private readonly messageHandler;
    private readonly contactHandler;
    private readonly groupHandler;

    constructor(sessionOption: SessionOptions, event: BaileysEventEmitter) {
        this.chatHandler = handlers.chatHandler(sessionOption, event);
        this.messageHandler = handlers.messageHandler(sessionOption, event);
        this.contactHandler = handlers.contactHandler(sessionOption, event);
        this.groupHandler = handlers.groupHandler(sessionOption, event);

        this.listen();
    }

    /** Start listening to the events */
    public listen() {
        this.chatHandler.listen();
        this.messageHandler.listen();
        this.contactHandler.listen();
        this.groupHandler.listen();
    }

    /** Stop listening to the events */
    public unlisten() {
        this.chatHandler.unlisten();
        this.messageHandler.unlisten();
        this.contactHandler.unlisten();
        this.groupHandler.unlisten();
    }
}
