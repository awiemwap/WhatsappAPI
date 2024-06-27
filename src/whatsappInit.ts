import { PrismaClient } from '@prisma/client';
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { promises as fsPromises } from 'fs';
import pino from 'pino';
import { Session } from './session';
import { useLogger, usePrisma } from './shared';
import { initStore } from './store';

// in the future, we can use store sessions in redis instead of memory
export const sessions = new Map<string, Session>();
export const SESSION_CONFIG_ID = 'session-config';

// initialize logger
// make sure logs/wa.log exists
const logFilePath = `${__dirname}/logs/wa.log`;
fsPromises.mkdir(`${__dirname}/logs`, { recursive: true });

const loggerTransport = pino.transport({
    targets: [
        {
            target: 'pino/file',
            options: { destination: logFilePath },
        },
        {
            target: 'pino-pretty',
            options: {
                colorize: true,
            },
        },
    ],
});

export async function init() {
    // initialize store (DB) and set logger config
    initStore({
        prisma: new PrismaClient(),
        logger: pino(
            {
                level: process.env.LOG_LEVEL || 'debug',
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            loggerTransport
        ) as any,
    });

    process.on('uncaughtException', async (error) => {
        useLogger().error(error, 'Uncaught Exception');

        throw error;
        // this.reconnect(); reconnect the session
    });

    process.on('unhandledRejection', async (error) => {
        useLogger().error(error, 'Unhandled Rejection');
    });

    // Fetch all sessions from DB
    const sessions = await usePrisma().session.findMany({
        select: { sessionId: true, data: true },
        where: { id: { startsWith: SESSION_CONFIG_ID } },
    });

    // Fetch latest version of WA Web
    const { version, isLatest } = await fetchLatestBaileysVersion();
    useLogger().info(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    // Create sessions
    for (const { sessionId, data } of sessions) {
        const options = JSON.parse(data);

        if (!options.socketConfig) options.socketConfig = {};
        if (options.readIncomingMessages === undefined) options.readIncomingMessages = true;
        if (options.doNotIgnoreBroadcast === undefined) options.doNotIgnoreBroadcast = true;

        options.socketConfig.version = version;
        options.sessionId = sessionId;

        // Create session
        Session.create(options);
    }
}
