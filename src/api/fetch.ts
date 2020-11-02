import { Result, error, success } from '../result';

export async function fetchJson<T>(url: string): Promise<Result<T, string>> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return error(response.statusText);
        }
        const data: T = await response.json();
        return success(data);
    } catch (e) {
        return error(e.statusText);
    }
}
