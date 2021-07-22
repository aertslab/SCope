import { Either, Left, Right } from 'sanctuary-either';

export async function fetchJson<T>(url: string): Promise<Either<string, T>> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return Left(response.statusText);
        }
        const data: T = await response.json();
        return Right(data);
    } catch (e) {
        return Left(e.statusText);
    }
}
