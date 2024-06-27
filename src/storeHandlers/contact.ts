import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { BaileysEventEmitter, Contact } from '@whiskeysockets/baileys';
import { sendWebhook } from '../services/webhook';
import type { SessionOptions } from '../session';
import { useLogger, usePrisma } from '../shared';
import { transformPrisma } from '../utils';

export default function contactHandler(sessionOption: SessionOptions, event: BaileysEventEmitter) {
    let hasStartedListening = false;
    const sessionId = sessionOption.sessionId;

    /**
     * Sets the contacts in the store.
     *
     * @param contacts - The contacts to be set.
     * @param isLatest - A flag indicating whether the contacts are the latest version.
     * @returns A Promise that resolves when the contacts are set.
     */
    async function set({ contacts, isLatest }: { contacts: Contact[]; isLatest: boolean }): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'messaging-history.set',
            payload: { as: 'contacts.set', contacts, isLatest },
        });

        try {
            if (contacts.length === 0) {
                logger.info('No contacts to sync');

                return;
            }

            const upsertPromises = contacts
                .map((c) => transformPrisma(c))
                .map((data) => {
                    // check if the name or notify columns are empty to prevent updating the contact
                    // and losing the name or notify
                    let update = data;

                    if (!data.name) {
                        delete update.name;
                    }

                    if (!data.notify) {
                        delete update.notify;
                    }

                    return prisma.contact.upsert({
                        select: { pkId: true },
                        create: { ...data, sessionId },
                        update,
                        where: { sessionId_id: { id: data.id, sessionId } },
                    });
                });

            await Promise.any(upsertPromises);
            logger.info({ contacts: contacts.length }, 'Synced contacts');
        } catch (e) {
            logger.error(e, 'An error occurred during contacts set');
        }
    }

    /**
     * Upserts the given contacts into the database.
     * If a contact with the same sessionId and id already exists, it will be updated.
     * Otherwise, a new contact will be created.
     *
     * @param contacts - The contacts to upsert.
     * @returns A Promise that resolves when the upsert operation is complete.
     */
    async function upsert(contacts: Contact[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();
        try {
            await Promise.any(
                contacts
                    .map((c) => transformPrisma(c))
                    .map(async (data) => {
                        // check if the name or notify columns are empty to prevent updating the contact
                        // and losing the name or notify
                        let update = data;

                        if (!data.name) {
                            delete update.name;
                        }

                        if (!data.notify) {
                            delete update.notify;
                        }

                        return prisma.contact.upsert({
                            select: { pkId: true },
                            create: { ...data, sessionId },
                            update,
                            where: { sessionId_id: { id: data.id, sessionId } },
                        });
                    })
            );
        } catch (e) {
            logger.error(e, 'An error occurred during contacts upsert');
        }
    }

    /**
     * Updates the contacts with the specified updates.
     *
     * @param updates - An array of partial contact objects containing the updates.
     * @returns - Promise<void>
     */
    async function update(updates: Partial<Contact>[]) {
        const prisma = usePrisma();
        const logger = useLogger();
        for (const updateData of updates) {
            try {
                const data = transformPrisma(updateData);
                const contactExists = await prisma.contact.findUnique({
                    where: { sessionId_id: { id: data.id!, sessionId } },
                });

                if (contactExists) {
                    if (!data.name) {
                        delete data.name;
                    }

                    if (!data.notify) {
                        delete data.notify;
                    }

                    await prisma.contact.update({
                        select: { pkId: true },
                        data: data,
                        where: { sessionId_id: { id: data.id!, sessionId } },
                    });
                }
            } catch (e) {
                if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
                    return logger.info({ updateData }, 'Got update for non existent contact');
                }
                logger.error(e, 'An error occurred during contact update');
            }
        }
    }

    const listen = () => {
        if (hasStartedListening) return;

        event.on('messaging-history.set', set);
        event.on('contacts.upsert', upsert);
        event.on('contacts.update', update);
        hasStartedListening = true;
    };

    const unlisten = () => {
        if (!hasStartedListening) return;

        event.off('messaging-history.set', set);
        event.off('contacts.upsert', upsert);
        event.off('contacts.update', update);
        hasStartedListening = false;
    };

    return { listen, unlisten };
}
