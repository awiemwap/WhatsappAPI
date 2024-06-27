import type { Boom } from '@hapi/boom';
import makeWASocket, {
    BaileysEventMap,
    Browsers,
    ConnectionState,
    DisconnectReason,
    isJidBroadcast,
    makeCacheableSignalKeyStore,
    proto,
    SocketConfig,
    WAMessageKey,
} from '@whiskeysockets/baileys';
import { Response } from 'express';
import NodeCache from 'node-cache';
import ProxyAgent from 'proxy-agent';
import { toDataURL } from 'qrcode';
import type { WebSocket } from 'ws';
import { sendWebhook } from './services/webhook';
import { useLogger, usePrisma } from './shared';
import { Store } from './store';
import { useSession } from './useSession';
import { delay, response } from './utils';
import { sessions, SESSION_CONFIG_ID } from './whatsappInit';

export const retries = new Map<string, number>();
export const QRGenerations = new Map<string, number>();

export const RECONNECT_INTERVAL = Number(process.env.RECONNECT_INTERVAL || 0);
export const MAX_RECONNECT_RETRIES = Number(process.env.MAX_RECONNECT_RETRIES || 5);
export const MAX_QR_GENERATION = Number(process.env.MAX_QR_GENERATION || 5);

export type SessionOptions = {
    sessionId: string;
    res?: Response;
    SSE?: boolean;
    readIncomingMessages?: boolean;
    proxy?: string;
    doNotIgnoreBroadcast?: boolean;
    webhook?: {
        enabled: boolean;
        events: 'all' | (keyof BaileysEventMap)[];
    };
    socketConfig?: SocketConfig;
    usePairingCode?: boolean;
    phoneNumber?: string;
};

/**
 * Determines whether a session should reconnect based on the number of attempts made.
 * @param sessionId - The ID of the session.
 * @returns A boolean indicating whether the session should reconnect.
 */
export function shouldReconnect(sessionId: string) {
    const maxRetries = parseInt(process.env.MAX_RECONNECT_RETRIES) || 5;
    let attempts = retries.get(sessionId) ?? 0;

    if (attempts < MAX_RECONNECT_RETRIES || maxRetries === -1) {
        attempts = attempts + 1;

        useLogger().info({ attempts, sessionId }, 'Reconnecting...');

        retries.set(sessionId, attempts);

        return true;
    }

    return false;
}

/**
 * Represents a session object for interacting with the WhatsApp API.
 */
export class Session {
    private connectionState: Partial<ConnectionState> = { connection: 'close' };
    private lastGeneratedQR: string | null = null;
    public readonly socket: ReturnType<typeof makeWASocket>;
    public readonly store: Store;

    /**
     * Represents a session object for interacting with the WhatsApp API.
     * @param sessionState - The state of the session.
     * @param options - The options for the session.
     */
    constructor(
        private readonly sessionState: Awaited<ReturnType<typeof useSession>>,
        private readonly options: SessionOptions
    ) {
        const { sessionId, socketConfig, proxy } = options;

        const browser = socketConfig?.browser ?? Browsers.ubuntu('Chrome');

        this.socket = makeWASocket({
            printQRInTerminal: true,
            browser,
            generateHighQualityLinkPreview: true,
            ...socketConfig,
            logger: useLogger(),
            agent: proxy ? new ProxyAgent() : undefined,
            // external map to store retry counts of messages when decryption/encryption fails
            // keep this out of the socket itself, so as to prevent a message
            //decryption/ encryption loop across socket restarts
            msgRetryCounterCache: new NodeCache({ stdTTL: 60, checkperiod: 120 }),
            auth: {
                creds: sessionState.state.creds,
                keys: makeCacheableSignalKeyStore(sessionState.state.keys, useLogger()),
            },
            // ignore all broadcast messages
            shouldIgnoreJid: (jid) => (options?.doNotIgnoreBroadcast ? false : isJidBroadcast(jid)),

            // handle retries & poll updates
            getMessage: this.getMessage,
        });

        this.bindEvents();

        // Initialize store with the listeners for BAILEYS events
        this.store = new Store(options, this.socket.ev);

        // Add session to sessions map
        sessions.set(sessionId, this);
    }

    /**
     * Creates a new session with the given options.
     * @param options - The options for the session.
     * @returns A promise that resolves to a new Session instance.
     */
    public static async create(options: SessionOptions) {
        const configID = `${SESSION_CONFIG_ID}-${options.sessionId}`;

        // stringify options to save into databases as JSON but don't save the res objec
        const data = JSON.stringify({ ...options, res: undefined });

        const [sessionState, _]: [Awaited<ReturnType<typeof useSession>>, any] = await Promise.all([
            // Get or create session state either from the database or from scratch (if it doesn't exist)
            useSession(options.sessionId),

            // Create session config in database, or update if it already exists
            usePrisma().session.upsert({
                create: {
                    id: configID,
                    sessionId: options.sessionId,
                    data,
                },
                update: { data },
                where: { sessionId_id: { id: configID, sessionId: options.sessionId } },
            }),
        ]);

        // Initialize session and socket to WA Web
        return new Session(sessionState, options);
    }

    /**
     * Returns an array of session objects containing the session ID and status.
     * @returns An array of session objects.
     */
    public static list(): { id: string; status: string; options: SessionOptions }[] {
        return Array.from(sessions.entries()).map(([id, session]) => ({
            id,
            status: session.status(),
            options: session.options,
        }));
    }

    public static get(sessionId: string): Session {
        return sessions.get(sessionId) ?? null;
    }

    /**
     * Deletes a session with the specified session ID.
     * @param sessionId The ID of the session to delete.
     * @returns A Promise that resolves when the session is deleted.
     */
    public static async delete(sessionId: string): Promise<void> {
        await Session.get(sessionId)?.destroy();
    }

    /**
     * Checks if a session with the given sessionId exists.
     * @param sessionId - The ID of the session to check.
     * @returns A boolean indicating whether the session exists or not.
     */
    public static exists(sessionId: string): boolean {
        return sessions.has(sessionId);
    }

    /**
     * Retrieves a message based on the provided WAMessageKey.
     * @param key The WAMessageKey object containing the remoteJid and id of the message.
     * @returns The retrieved message as a proto.IMessage object, or undefined if not found.
     */
    protected async getMessage(key: WAMessageKey) {
        const { sessionId } = this.options;

        const data = await usePrisma().message.findFirst({
            where: { remoteJid: key.remoteJid!, id: key.id!, sessionId },
        });

        return (data?.message || undefined) as proto.IMessage | undefined;
    }

    public getLatestGeneratedQR(): string | null {
        return this.lastGeneratedQR;
    }

    /**
     * Returns the current status of the session.
     */
    public status(): string {
        const state = ['CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
        let status = state[(this.socket.ws as WebSocket).readyState];
        status = this.socket.user ? 'AUTHENTICATED' : status;

        return status;
    }

    /**
     * Checks if an id exists on whatsapp or not.
     *
     * @param jid - The JID to check.
     * @param type - The type of JID. Default is 'number'.
     *
     * @returns A promise that resolves to a boolean indicating whether the JID exists or not.
     */
    public async jidExists(jid: string, type: 'group' | 'number' = 'number'): Promise<boolean> {
        try {
            if (type === 'number') {
                const [result] = await this.socket.onWhatsApp(jid);
                return !!result?.exists;
            }

            const groupMetadata = await this.socket.groupMetadata(jid);
            return !!groupMetadata.id;
        } catch (e) {
            return Promise.reject(e);
        }
    }

    /**
     * Destroys the session.
     * @param logout - Whether to perform a logout before destroying the session. Default is true.
     * @returns A promise that resolves when the session is destroyed.
     */
    public async destroy(logout: boolean = true): Promise<void> {
        const { sessionId } = this.options;
        const ws = this.socket.ws;
        try {
            await Promise.all([
                logout && ws.readyState !== ws.CLOSING && ws.readyState !== ws.CLOSED && this.socket.logout(),
                usePrisma().session.deleteMany({ where: { sessionId } }),
                // usePrisma().chat.deleteMany({ where: { sessionId } }),
                // usePrisma().contact.deleteMany({ where: { sessionId } }),
                // usePrisma().message.deleteMany({ where: { sessionId } }),
            ]);

            useLogger().info(`Session ${sessionId} destroyed`);
        } catch (e) {
            useLogger().error(e, 'An error occurred during session destroy');
        } finally {
            sessions.delete(sessionId);
            retries.delete(sessionId);
            QRGenerations.delete(sessionId);
        }
    }

    /**
     * Binds event listeners for the session.
     */
    private async bindEvents() {
        // the process function lets you process all events that just occurred
        // efficiently in a batch
        this.socket.ev.process(async (events: BaileysEventMap) => {
            // credentials updated -- save them
            if (events['creds.update']) {
                const update = events['creds.update'];
                await this.sessionState.saveCreds();

                sendWebhook(this.options, { event: 'creds.update', payload: update });
                console.log('creds updated', update);
            }

            // something about the connection changed
            // maybe it closed, or we received all offline message or connection opened
            if (events['connection.update']) {
                const update = events['connection.update'];

                sendWebhook(this.options, { event: 'connection.update', payload: update });

                const { connection } = update;
                this.connectionState = update;

                if (connection) useLogger().info('Connection Status: ' + connection);

                if (connection === 'open') {
                    this.lastGeneratedQR = null;
                    retries.delete(this.options.sessionId);
                    QRGenerations.delete(this.options.sessionId);

                    useLogger().info('Session ' + this.options.sessionId + ' created');
                } else if (connection === 'close') await this.handleConnectionClose();

                await this.handleConnectionUpdate();
            }

            // If readIncomingMessages is true, read all incoming messages
            if (this.options.readIncomingMessages) {
                if (events['messages.upsert']) {
                    const messageEvent = events['messages.upsert'];

                    const message = messageEvent.messages[0];

                    sendWebhook(this.options, { event: 'messages.upsert', payload: messageEvent });

                    if (message.key.fromMe || messageEvent.type !== 'notify') return;

                    await delay(1000);
                    await this.socket.readMessages([message.key]);
                }
            }
        });
    }

    /**
     * Handles the connection update for the session.
     * If pairing code is enabled and phone number is provided, it waits for the connection update event,
     * requests a pairing code, and sends the code to the client for verification.
     * If pairing code is not enabled or phone number is not provided, it generates a QR code for the client to scan.
     * If the maximum number of QR code generations is reached, it destroys the session.
     * If Server-Sent Events (SSE) is enabled, it sends the connection state and generated QR code to the client.
     * If SSE is not enabled, it sends the connection state and generated QR code as JSON response to the client.
     *
     * @returns A promise that resolves when the connection update is handled.
     */
    private async handleConnectionUpdate(): Promise<void> {
        const { sessionId, res, SSE, usePairingCode, phoneNumber } = this.options;

        if (
            usePairingCode &&
            phoneNumber &&
            !this.sessionState.state.creds.registered &&
            !this.sessionState.state.creds.account
        ) {
            await this.socket.waitForConnectionUpdate((update) => {
                useLogger().info({ update, connectionState: this.connectionState }, 'Connection Update event');
                return Boolean(update.qr);
            });

            const code = await this.socket.requestPairingCode(phoneNumber);

            if (res && !res.headersSent && code !== undefined) {
                return response(res, 200, true, 'Verify on your phone and enter the provided code.', { code });
            } else {
                useLogger().error(`Unable to send pairing code to phone number ${phoneNumber}`);

                response(res, 500, false, 'Unable to create session.');
            }
        }

        const { qr } = this.connectionState;
        let generatedQR: string | null = null;
        const currentQRGenerations = QRGenerations.get(sessionId) ?? -1;

        if (qr) {
            try {
                generatedQR = await toDataURL(qr);
                this.lastGeneratedQR = generatedQR;
                QRGenerations.set(sessionId, currentQRGenerations + 1);
            } catch (e) {
                useLogger().error(e, 'An error occurred during QR generation');
            }
        }

        const limitReached = currentQRGenerations >= MAX_QR_GENERATION;

        if (limitReached) this.destroy();

        if (!res || res.writableEnded) return;

        if (SSE) {
            res.write(
                `data: ${JSON.stringify(
                    limitReached
                        ? { error: 'QR max generation attempts reached' }
                        : { ...this.connectionState, qr: generatedQR }
                )}\n\n`
            );
            if (limitReached) res.end();
        } else {
            if (limitReached) res.status(500).json({ error: 'QR max generation attempts reached' }).end();
            else if (!limitReached && qr && generatedQR) res.status(200).json({ qr: generatedQR });
            else if (!limitReached && qr && !generatedQR) res.status(500).json({ error: 'Unable to generate QR' });
        }
    }

    /**
     * Handles the connection close event.
     * @returns A promise that resolves once the handling is complete.
     */
    private async handleConnectionClose(): Promise<void> {
        const { sessionId, res, SSE } = this.options;
        const reasonCode = (this.connectionState.lastDisconnect?.error as Boom)?.output?.statusCode;

        switch (reasonCode) {
            case DisconnectReason.badSession:
                useLogger().error(`Bad Session, Please Delete /auth and Scan Again`);
                break;
            case DisconnectReason.connectionClosed:
                useLogger().warn('Connection closed, reconnecting....');
                break;
            case DisconnectReason.connectionLost:
                useLogger().warn('Connection Lost from Server, reconnecting...');
                break;
            case DisconnectReason.connectionReplaced:
                useLogger().error(
                    'Connection Replaced, Another New Session Opened, Please Close Current Session First'
                );
                break;
            case DisconnectReason.loggedOut:
                useLogger().error(`Device Logged Out, Please Delete /auth and Scan Again.`);
                break;
            case DisconnectReason.restartRequired:
                useLogger().info('Restart Required, Restarting...');
                break;
            case DisconnectReason.timedOut:
                useLogger().warn('Connection TimedOut, Reconnecting...');
                break;
            default:
                useLogger().warn(`Unknown DisconnectReason: ${reasonCode}: ${this.connectionState.connection}`);
                break;
        }

        const doNotReconnect = !shouldReconnect(sessionId);

        if (reasonCode === DisconnectReason.loggedOut || doNotReconnect) {
            if (res && !res.writableEnded) {
                !SSE && res.status(500).json({ error: 'Unable to create session' });
                res.end();
            }

            return await this.destroy(doNotReconnect);
        }

        this.reconnect();
    }

    /**
     * Reconnects the session to the server.
     * If the last disconnect reason is "restartRequired", the session is immediately recreated.
     * Otherwise, the session is recreated after a delay of RECONNECT_INTERVAL milliseconds.
     */
    public reconnect() {
        const reasonCode = (this.connectionState.lastDisconnect?.error as Boom)?.output?.statusCode;
        const restartRequired = reasonCode === DisconnectReason.restartRequired;

        setTimeout(() => Session.create(this.options), restartRequired ? 0 : RECONNECT_INTERVAL);
    }
}
