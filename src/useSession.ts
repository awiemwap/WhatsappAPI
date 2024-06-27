import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';
import { useLogger, usePrisma } from './shared';

/**
 * Replaces characters in the given ID string to make it compatible for use.
 * Replaces forward slashes with '__', colons with '-', and periods with '--'.
 *
 * @param id - The ID string to be fixed.
 * @returns The fixed ID string.
 */
const fixId = (id: string) => id.replace(/\//g, '__').replace(/:/g, '-').replace(/\./g, '--');

/**
 * Retrieves and manipulates session data for a given session ID.
 * @param sessionId - The ID of the session.
 * @returns An object containing methods to read, write, and remove session data.
 */
export async function useSession(sessionId: string) {
    const model = usePrisma().session;
    const logger = useLogger();

    /**
     * Writes session data to the database.
     * If the session data already exists, it updates the existing data.
     * If the session data does not exist, it inserts a new record.
     *
     * @param data - The data to be written.
     * @param id  - The ID of the session data to be written.
     */
    const write = async (data: any, id: string) => {
        try {
            data = JSON.stringify(data, BufferJSON.replacer);
            id = fixId(id);

            await usePrisma()
                .$executeRaw`INSERT INTO sessions (data, id, session_id) VALUES (${data}, ${id}, ${sessionId}) ON DUPLICATE KEY UPDATE data = ${data}`;
        } catch (e) {
            logger.error(e, 'An error occurred during session write');
        }
    };

    /**
     * Reads the session data for a given ID.
     * @param id - The ID of the session data to read.
     * @returns The parsed session data, or undefined if the session data does not exist or an error occurred.
     */
    const read = async (id: string) => {
        id = fixId(id);

        try {
            const { data } = await model.findUniqueOrThrow({
                select: { data: true },
                where: { sessionId_id: { id: id, sessionId } },
            });

            return JSON.parse(data, BufferJSON.reviver);
        } catch (e) {
            if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
                logger.info({ id }, 'Trying to read non existent session data');
            } else {
                logger.error(e, 'An error occurred during session read. ID: ' + id);
            }
            return undefined;
        }
    };

    /**
     * Removes a session with the specified ID.
     *
     * @param id - The ID of the session to remove.
     */
    const remove = async (id: string) => {
        try {
            await model.delete({
                select: { pkId: true },
                where: { sessionId_id: { id: fixId(id), sessionId } },
            });
        } catch (e) {
            logger.error(e, 'An error occurred during session delete');
        }
    };

    // Initialize credentials either from the database or from scratch
    const creds: AuthenticationCreds = (await read('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};

                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await read(`${type}-${id}`);

                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }

                            data[id] = value;
                        })
                    );

                    return data;
                },
                set: async (data: any) => {
                    const tasks: Promise<void>[] = [];

                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const sId = `${category}-${id}`;
                            tasks.push(value ? write(value, sId) : remove(sId));
                        }
                    }

                    await Promise.all(tasks);
                },
            },
        },

        saveCreds: () => write(creds, 'creds'),
        removeCreds: (id: string) => remove(id),
    };
}
