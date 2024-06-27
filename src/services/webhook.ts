import { BaileysEventMap } from '@whiskeysockets/baileys';
import axios, { AxiosRequestConfig } from 'axios';
import { SessionOptions } from '../session';
import { useLogger } from '../shared';
import { delay } from '../utils';

/**
 * Sends a webhook with the specified event and payload.
 * @param data - The event and payload to send in the webhook.
 * @returns A Promise that resolves when the webhook is sent successfully.
 */
export async function sendWebhook(
    options: Partial<SessionOptions>,
    data: { event: keyof BaileysEventMap; payload: any }
): Promise<void> {
    if (!options.webhook?.enabled) {
        return;
    }

    const { events: onlyListenForTheseEvents } = options.webhook;

    if (onlyListenForTheseEvents !== 'all' && !onlyListenForTheseEvents.includes(data.event)) return;

    if (!process.env.WEBHOOK_URL?.length) {
        useLogger().warn('No webhook url provided, while webhook is enabled.');

        return;
    }

    try {
        await requestWebhook(process.env.WEBHOOK_URL, {
            sessionId: options.sessionId,
            data,
        });
    } catch (e) {
        useLogger().error(e, `An error occurred during webhook send for event ${data.event}`);
    }
}

/**
 * Sends a webhook request to the specified URL with the provided data using Axios.
 * @param url - The URL to send the webhook request to.
 * @param data - The data to send in the webhook request.
 * @param axiosConfig - Optional Axios request configuration.
 * @returns A Promise that resolves to the Axios response object.
 */
export async function requestWebhook(url: string | null, data: object, axiosConfig: AxiosRequestConfig | null = {}) {
    if (!url) return;

    const logger = useLogger();

    let tries = 3;

    axiosConfig.headers = {
        ...axiosConfig.headers,

        // Todo: add more headers (custom)
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    axiosConfig.timeout = axiosConfig.timeout || 10000;

    try {
        return await axios.post(url, data, axiosConfig);
    } catch (error) {
        logger.error(error, `An error occurred during webhook send to ${url}, tries left: ${tries}. Retrying...`);

        if (tries > 0) {
            await delay(5000);
            await requestWebhook(url, data, axiosConfig);
            tries = tries - 1;

            logger.info(`Retrying webhook send to ${url}, tries left: ${tries}`);
        }
    }
}
