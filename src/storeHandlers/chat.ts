import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { BaileysEventEmitter, Chat, ChatUpdate } from '@whiskeysockets/baileys';
import { sendWebhook } from '../services/webhook';
import type { SessionOptions } from '../session';
import { useLogger, usePrisma } from '../shared';
import { transformPrisma } from '../utils';

export default function chatHandler(sessionOption: SessionOptions, event: BaileysEventEmitter) {
    let hasStartedListening = false;
    const sessionId = sessionOption.sessionId;

    /**
     * Sets the chats in the store.
     *
     * @param chats - The array of chats to set.
     * @param isLatest - Indicates whether the chats are the latest.
     * @returns - A promise that resolves when the chats are set.
     */
    async function set({ chats, isLatest }): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messaging-history.set',
            payload: { as: 'chats.set', chats, isLatest },
        });

        try {
            if (chats.length === 0) {
                logger.info('No chats to sync');

                return;
            }

            // if there's a chat that doesn't exist, create it
            // otherwise, dont sync existing chats
            await prisma.$transaction(async (tx) => {
                const existingIds = (
                    await tx.chat.findMany({
                        select: { id: true },
                        where: { id: { in: chats.map((c) => c.id) }, sessionId },
                    })
                ).map((i) => i.id);

                const chatsAdded = (
                    await tx.chat.createMany({
                        // @ts-ignore
                        data: chats
                            .filter((c) => !existingIds.includes(c.id))
                            .map((c) => ({ ...transformPrisma(c), sessionId: sessionOption.sessionId })),
                    })
                ).count;

                logger.info({ chatsAdded }, 'Synced chats');
            });
        } catch (e) {
            logger.error(e, 'An error occurred during chats set');
        }
    }

    /**
     * Upserts the given chats into the database.
     *
     * @param chats An array of chats to upsert.
     * @returns A Promise that resolves when the upsert operation is complete.
     */
    async function upsert(chats: Chat[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'chats.upsert',
            payload: { chats },
        });

        try {
            await Promise.any(
                chats
                    .map((c) => transformPrisma(c))
                    .map((data) =>
                        prisma.chat.upsert({
                            select: { pkId: true },
                            // @ts-ignore
                            create: { ...data, sessionId },
                            update: data,
                            where: { sessionId_id: { id: data.id, sessionId } },
                        })
                    )
            );
        } catch (e) {
            logger.error(e, 'An error occurred during chats upsert');
        }
    }

    /**
     * Updates the chat data based on the provided updates.
     *
     * This function takes an array of ChatUpdate objects containing the updated chat data.
     * It sends a webhook event with the updates and updates the chat data in the database.
     * If a chat already exists in the database, it updates the chat with the new data.
     *
     * @param updates - An array of ChatUpdate objects containing the updated chat data.
     * @returns A Promise that resolves to void.
     */
    async function update(updates: ChatUpdate[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'chats.update',
            payload: { chats: updates },
        });

        for (const updateData of updates) {
            try {
                const data = transformPrisma(updateData);
                const chatExists = await prisma.chat.findUnique({
                    where: { sessionId_id: { id: data.id!, sessionId } },
                });

                // here we update the unread count if it's a number
                if (chatExists) {
                    await prisma.chat.update({
                        select: { pkId: true },
                        data: {
                            ...data,
                            unreadCount:
                                typeof data.unreadCount === 'number'
                                    ? data.unreadCount > 0
                                        ? { increment: data.unreadCount }
                                        : { set: data.unreadCount }
                                    : undefined,
                        },
                        where: { sessionId_id: { id: data.id!, sessionId } },
                    });
                }
            } catch (e) {
                if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
                    return logger.info({ updateData }, 'Got update for non-existent chat');
                }
                logger.error(e, 'An error occurred during chat update');
            }
        }
    }

    /**
     * Deletes chats with the specified IDs.
     * @param ids - An array of chat IDs to delete.
     * @returns A Promise that resolves when the deletion is complete.
     */
    async function del(ids: string[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'chats.delete',
            payload: { chats: ids },
        });

        try {
            await prisma.chat.deleteMany({
                where: { id: { in: ids } },
            });
        } catch (e) {
            logger.error(e, 'An error occurred during chats delete');
        }
    }

    /**
     * Handles the event when a phone number is shared in a chat.
     *
     * @param update - The update object containing the lid and jid.
     * @returns A Promise that resolves to void.
     */
    async function chatPhoneNumberShare(update: { lid: string; jid: string }): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'chats.phoneNumberShare',
            payload: { chats: update },
        });

        // Todo figure out what do do with this
    }

    const listen = () => {
        if (hasStartedListening) return;

        event.on('messaging-history.set', set);
        event.on('chats.upsert', upsert);
        event.on('chats.update', update);
        event.on('chats.delete', del);
        event.on('chats.phoneNumberShare', chatPhoneNumberShare);

        hasStartedListening = true;
    };

    const unlisten = () => {
        if (!hasStartedListening) return;

        event.off('messaging-history.set', set);
        event.off('chats.upsert', upsert);
        event.off('chats.update', update);
        event.off('chats.delete', del);
        event.off('chats.phoneNumberShare', chatPhoneNumberShare);

        hasStartedListening = false;
    };

    return { listen, unlisten };
}
