import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { BaileysEventEmitter, GroupMetadata } from '@whiskeysockets/baileys';
import { sendWebhook } from '../services/webhook';
import type { SessionOptions } from '../session';
import { useLogger, usePrisma } from '../shared';
import { transformPrisma } from '../utils';

export default function groupHandler(sessionOption: SessionOptions, event: BaileysEventEmitter) {
    let hasStartedListening = false;
    const sessionId = sessionOption.sessionId;

    /**
     * Upserts the given groups into the database.
     *
     * @param groups - An array of GroupMetadata objects to be upserted.
     * @returns A Promise that resolves when the upsert operation is complete.
     */
    async function upsert(groups: GroupMetadata[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'groups.upsert',
            payload: { groups },
        });

        try {
            if (groups.length === 0) {
                logger.info('No groups to sync');

                return;
            }

            await Promise.any(
                groups
                    .map((g) => transformPrisma(g))
                    .map((data) =>
                        prisma.group.upsert({
                            select: { pkId: true },
                            create: { ...data, sessionId },
                            update: data,
                            where: { sessionId_id: { id: data.id, sessionId } },
                        })
                    )
            );

            logger.info({ groups: groups.length }, 'Synced groups');
        } catch (e) {
            logger.error(e, 'An error occurred during groups upsert');
        }
    }

    /**
     * Updates the group metadata in the database.
     *
     * @param updates - An array of partial group metadata objects containing the updates.
     * @returns A Promise that resolves to void.
     */
    async function update(updates: Partial<GroupMetadata>[]): Promise<void> {
        const prisma = usePrisma();
        const logger = useLogger();

        sendWebhook(sessionOption, {
            event: 'groups.update',
            payload: { groups: updates },
        });

        for (const update of updates) {
            try {
                await prisma.group.update({
                    select: { pkId: true },
                    data: transformPrisma(update),
                    where: { sessionId_id: { id: update.id!, sessionId } },
                });
            } catch (e) {
                if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
                    return logger.info({ update }, 'Got update for non-existent group');
                }
                logger.error(e, 'An error occurred during group update');
            }
        }
    }

    const listen = () => {
        if (hasStartedListening) return;

        event.on('groups.upsert', upsert);
        event.on('groups.update', update);
        hasStartedListening = true;
    };

    const unlisten = () => {
        if (!hasStartedListening) return;

        event.off('groups.upsert', upsert);
        event.off('groups.update', update);
        hasStartedListening = false;
    };

    return { listen, unlisten };
}
