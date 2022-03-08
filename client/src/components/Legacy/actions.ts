import * as Action from './actionTypes';

export interface DecodeSessionData {
    type: typeof Action.DECODE_LEGACY_PERMALINK;
    payload: { sessiondata };
}

export const decodeSessionData = (sessiondata: string): DecodeSessionData => {
    return {
        type: Action.DECODE_LEGACY_PERMALINK,
        payload: { sessiondata },
    };
};

export interface Error {
    type: typeof Action.ERROR;
    payload: {
        message: string;
    };
}

export const error = (err: string): Error => {
    return {
        type: Action.ERROR,
        payload: { message: err },
    };
};

export type ActionT = DecodeSessionData | Error;
