import { Result, error, success } from '../result';

export async function fetchJson<T>(url: string): Promise<Result<T, string>> {
    try {
        const response: Response = await fetch(url);
        if (!response.ok) {
            return error(response.statusText);
        }
        const data: T = await response.json();
        return success(data);
    } catch (err: unknown) {
        return error(`Unknown error: ${JSON.stringify(err)}`);
    }
}
