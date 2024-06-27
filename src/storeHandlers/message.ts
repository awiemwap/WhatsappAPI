import type {
    BaileysEventEmitter,
    MessageUpsertType,
    MessageUserReceipt,
    MessageUserReceiptUpdate,
    proto,
    WAMessage,
    WAMessageKey,
    WAMessageUpdate,
} from '@whiskeysockets/baileys';
import { jidNormalizedUser, toNumber } from '@whiskeysockets/baileys';
import { sendWebhook } from '../services/webhook';
import type { SessionOptions } from '../session';
import { useLogger, usePrisma } from '../shared';
import { transformPrisma } from '../utils';

/**
 * Returns the author of a given message key.
 * If the key is undefined or null, an empty string is returned.
 * If the key is from the current user, 'me' is returned.
 * Otherwise, the participant or remoteJid associated with the key is returned.
 *
 * @param key - The message key.
 * @returns The author of the message key.
 */
function getKeyAuthor(key: WAMessageKey | undefined | null) {
    return (key?.fromMe ? 'me' : key?.participant || key?.remoteJid) || '';
}

export default function messageHandler(sessionOption: SessionOptions, event: BaileysEventEmitter) {
    let hasStartedListening = false;
    const sessionId = sessionOption.sessionId;

    /**
     * Sets the messages in the store.
     *
     * @param options - The options for setting the messages.
     * @param options.messages - The messages to set.
     * @param options.isLatest - Indicates whether the messages are the latest.
     * @returns - A promise that resolves when the messages are set.
     */
    async function set({ messages, isLatest }: { messages: WAMessage[]; isLatest: boolean }): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messaging-history.set',
            payload: { as: 'messages.set', messages, isLatest },
        });

        try {
            if (messages.length === 0) {
                logger.info('No messages to sync');

                return;
            }

            for (const message of messages) {
                const jid = jidNormalizedUser(message.key.remoteJid!);
                const data = transformPrisma(message);

                await prisma.message.upsert({
                    select: { pkId: true },
                    // @ts-ignore
                    create: { ...data, remoteJid: jid, id: message.key.id!, sessionId },
                    update: { ...data },
                    where: { sessionId_remoteJid_id: { remoteJid: jid, id: message.key.id!, sessionId } },
                });
            }

            logger.info({ messages: messages.length }, 'Synced messages');
        } catch (e) {
            logger.error(e, 'An error occurred during messages set');
        }
    }

    /**
     * Upserts messages into the database.
     *
     * @param messages - The array of WAMessages to upsert.
     * @param type - The type of upsert operation to perform.
     * @returns A Promise that resolves when the upsert operation is complete.
     */
    async function upsert({ messages, type }: { messages: WAMessage[]; type: MessageUpsertType }): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messages.upsert',
            payload: { messages, type },
        });

        switch (type) {
            case 'append':
            case 'notify':
                for (const message of messages) {
                    try {
                        const jid = jidNormalizedUser(message.key.remoteJid!);
                        const data = transformPrisma(message);
                        await prisma.message.upsert({
                            select: { pkId: true },
                            // @ts-ignore
                            create: { ...data, remoteJid: jid, id: message.key.id!, sessionId },
                            update: { ...data },
                            where: { sessionId_remoteJid_id: { remoteJid: jid, id: message.key.id!, sessionId } },
                        });

                        const chatExists = (await prisma.chat.count({ where: { id: jid, sessionId } })) > 0;
                        if (type === 'notify' && !chatExists) {
                            event.emit('chats.upsert', [
                                {
                                    id: jid,
                                    conversationTimestamp: toNumber(message.messageTimestamp),
                                    unreadCount: 1,
                                },
                            ]);
                        }
                    } catch (e) {
                        logger.error(e, 'An error occurred during message upsert');
                    }
                }
                break;
        }
    }

    /**
     * Updates the messages in the store based on the provided updates.
     *
     * @param updates - An array of WAMessageUpdate objects containing the updates to be applied.
     * @returns A Promise that resolves once the updates have been applied.
     */
    async function update(updates: WAMessageUpdate[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messages.update',
            payload: { messages: updates },
        });

        for (const { update, key } of updates) {
            try {
                await prisma.$transaction(async (tx) => {
                    const prevData = await tx.message.findFirst({
                        where: { id: key.id!, remoteJid: key.remoteJid!, sessionId },
                    });

                    if (!prevData) {
                        return logger.info({ update }, 'Got update for non existent message');
                    }

                    const data = { ...prevData, ...update } as proto.IWebMessageInfo;

                    await tx.message.update({
                        where: {
                            sessionId_remoteJid_id: {
                                id: key.id!,
                                remoteJid: key.remoteJid!,
                                sessionId,
                            },
                        },
                        data: {
                            ...transformPrisma(data),
                            id: data.key.id!,
                            remoteJid: data.key.remoteJid!,
                            sessionId,
                        },
                    });
                });
            } catch (e) {
                logger.error(e, 'An error occurred during message update');
            }
        }
    }

    /**
     * Deletes messages from the store.
     * @param item The message or messages to delete.
     * @returns A Promise that resolves when the deletion is complete.
     */
    async function del(
        item:
            | {
                  keys: WAMessageKey[];
              }
            | {
                  jid: string;
                  all: true;
              }
    ) {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messages.delete',
            payload: { item },
        });

        try {
            if ('all' in item) {
                await prisma.message.deleteMany({ where: { remoteJid: item.jid, sessionId } });
                return;
            }

            const jid = item.keys[0].remoteJid!;

            await prisma.message.deleteMany({
                where: { id: { in: item.keys.map((k) => k.id!) }, remoteJid: jid, sessionId },
            });
        } catch (e) {
            logger.error(e, 'An error occurred during message delete');
        }
    }

    /**
     * Updates the receipt status of messages.
     *
     * @param updates - An array of `MessageUserReceiptUpdate` objects containing the updates to be applied.
     * @returns A Promise that resolves to void.
     */
    async function updateReceipt(updates: MessageUserReceiptUpdate[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'message-receipt.update',
            payload: { updates },
        });

        // Explanation of the code below:
        // 1. Get the message from the database.
        // 2. Get the user receipt array from the message.
        // 3. Find the receipt object that matches the userJid.
        // 4. If the receipt object exists, replace it with the new receipt object.
        // 5. Otherwise, push the new receipt object to the array.
        // 6. Update the message with the new user receipt array.

        for (const { key, receipt } of updates) {
            try {
                await prisma.$transaction(async (tx) => {
                    const message = await tx.message.findFirst({
                        select: { userReceipt: true },
                        where: { id: key.id!, remoteJid: key.remoteJid!, sessionId },
                    });

                    if (!message) {
                        return logger.debug({ update }, 'Got receipt update for non existent message');
                    }

                    let userReceipt = (message.userReceipt || []) as unknown as MessageUserReceipt[];
                    const recepient = userReceipt.find((m) => m.userJid === receipt.userJid);

                    if (recepient) {
                        userReceipt = [...userReceipt.filter((m) => m.userJid !== receipt.userJid), receipt];
                    } else {
                        userReceipt.push(receipt);
                    }

                    await tx.message.update({
                        select: { pkId: true },
                        data: transformPrisma({ userReceipt: userReceipt }),
                        where: {
                            sessionId_remoteJid_id: { id: key.id!, remoteJid: key.remoteJid!, sessionId },
                        },
                    });
                });
            } catch (e) {
                logger.error(e, 'An error occurred during message receipt update');
            }
        }
    }

    /**
     * Updates the reactions of messages.
     *
     * @param reactions - An array of reaction objects containing the key and reaction details.
     * @returns A Promise that resolves once the reactions are updated.
     */
    async function updateReaction(
        reactions: {
            key: WAMessageKey;
            reaction: proto.IReaction;
        }[]
    ): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messages.reaction',
            payload: { reactions },
        });

        // Explanation of the code below:
        // 1. Get the message from the database.
        // 2. Get the reactions array from the message.
        // 3. Find the reaction object that matches the author.
        // 4. If the reaction object exists, replace it with the new reaction object.
        // 5. Otherwise, push the new reaction object to the array.

        for (const { key, reaction } of reactions) {
            try {
                await prisma.$transaction(async (tx) => {
                    const message = await tx.message.findFirst({
                        select: { reactions: true },
                        where: { id: key.id!, remoteJid: key.remoteJid!, sessionId },
                    });
                    if (!message) {
                        return logger.debug({ update }, 'Got reaction update for non existent message');
                    }

                    const authorID = getKeyAuthor(reaction.key);
                    const reactions = ((message.reactions || []) as proto.IReaction[]).filter(
                        (r) => getKeyAuthor(r.key) !== authorID
                    );

                    if (reaction.text) reactions.push(reaction);

                    await tx.message.update({
                        select: { pkId: true },
                        data: transformPrisma({ reactions: reactions }),
                        where: {
                            sessionId_remoteJid_id: { id: key.id!, remoteJid: key.remoteJid!, sessionId },
                        },
                    });
                });
            } catch (e) {
                logger.error(e, 'An error occurred during message reaction update');
            }
        }
    }

    const listen = () => {
        if (hasStartedListening) return;

        event.on('messaging-history.set', set);
        event.on('messages.upsert', upsert);
        event.on('messages.update', update);
        event.on('messages.delete', del);
        event.on('message-receipt.update', updateReceipt);
        event.on('messages.reaction', updateReaction);
        hasStartedListening = true;
    };

    const unlisten = () => {
        if (!hasStartedListening) return;

        event.off('messaging-history.set', set);
        event.off('messages.upsert', upsert);
        event.off('messages.update', update);
        event.off('messages.delete', del);
        event.off('message-receipt.update', updateReceipt);
        event.off('messages.reaction', updateReaction);
        hasStartedListening = false;
    };

    return { listen, unlisten };
}
