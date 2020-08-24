export interface APIError {
    msg: string;
}

export function apiError(msg: string): APIError {
    return { msg };
}
