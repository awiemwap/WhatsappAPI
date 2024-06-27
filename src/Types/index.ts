import { BaileysEventMap, proto } from '@whiskeysockets/baileys';
import type Long from 'long';

export type MinimalMessage = Pick<proto.IWebMessageInfo, 'key' | 'messageTimestamp'>;

export interface sqlData {
    constructor: {
        name: 'RowDataPacket';
    };
    value?: Array<object>;
}

export type valueReplacer = {
    data: Array<number>;
    type: string;
};

export type valueReviver = {
    data: string;
    type: string;
};

export type KeyPair = {
    public: Uint8Array;
    private: Uint8Array;
};

export type SignedKeyPair = {
    keyPair: KeyPair;
    signature: Uint8Array;
    keyId: number;
    timestampS?: number;
};

export type SignalCreds = {
    readonly signedIdentityKey: KeyPair;
    readonly signedPreKey: SignedKeyPair;
    readonly registrationId: number;
};

export interface Contact {
    id: string;
    lid?: string;
    name?: string;
    notify?: string;
    verifiedName?: string;
    imgUrl?: string | null;
    status?: string;
}

export type ProtocolAddress = {
    name: string;
    deviceId: number;
};

export type SignalIdentity = {
    identifier: ProtocolAddress;
    identifierKey: Uint8Array;
};

export type AccountSettings = {
    unarchiveChats: boolean;
    defaultDisappearingMode?: Pick<proto.IConversation, 'ephemeralExpiration' | 'ephemeralSettingTimestamp'>;
};

export interface RegistrationOptions {
    /** your phone number */
    phoneNumber?: string;
    /** the country code of your phone number */
    phoneNumberCountryCode: string;
    /** your phone number without country code */
    phoneNumberNationalNumber: string;
    /** the country code of your mobile network
     * @see {@link https://de.wikipedia.org/wiki/Mobile_Country_Code}
     */
    phoneNumberMobileCountryCode: string;
    /** the network code of your mobile network
     * @see {@link https://de.wikipedia.org/wiki/Mobile_Network_Code}
     */
    phoneNumberMobileNetworkCode: string;
    /**
     * How to send the one time code
     */
    method?: 'sms' | 'voice' | 'captcha';
    /**
     * The captcha code if it was requested
     */
    captcha?: string;
}

export type AuthenticationCreds = SignalCreds & {
    readonly noiseKey: KeyPair;
    readonly pairingEphemeralKeyPair: KeyPair;
    advSecretKey: string;
    me?: Contact;
    account?: proto.IADVSignedDeviceIdentity;
    signalIdentities?: SignalIdentity[];
    myAppStateKeyId?: string;
    firstUnuploadedPreKeyId: number;
    nextPreKeyId: number;
    lastAccountSyncTimestamp?: number;
    platform?: string;
    processedHistoryMessages: MinimalMessage[];
    accountSyncCounter: number;
    accountSettings: AccountSettings;
    deviceId: string;
    phoneId: string;
    identityId: Buffer;
    registered: boolean;
    backupToken: Buffer;
    registration: RegistrationOptions;
    pairingCode: string | undefined;
};

export type BaileysEventHandler<T extends keyof BaileysEventMap> = (args: BaileysEventMap[T]) => void;

type TransformPrisma<T, TransformObject> = T extends Long
    ? number
    : T extends Uint8Array
    ? Buffer
    : T extends null
    ? never
    : T extends object
    ? TransformObject extends true
        ? object
        : T
    : T;

/** Transform unsupported types into supported Prisma types */
export type MakeTransformedPrisma<T extends Record<string, any>, TransformObject extends boolean = true> = {
    [K in keyof T]: TransformPrisma<T[K], TransformObject>;
};

type SerializePrisma<T> = T extends Buffer
    ? {
          type: 'Buffer';
          data: number[];
      }
    : T extends bigint
    ? string
    : T extends null
    ? never
    : T;

export type MakeSerializedPrisma<T extends Record<string, any>> = {
    [K in keyof T]: SerializePrisma<T[K]>;
};
