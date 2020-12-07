/* Utility functions */

import * as R from 'ramda';

/**
 * zip() but for an arbitrary number of lists.
 * Normally you should use R.zip, but sometimes you may want to "zip"
 * more than 2 arrays.
 *
 * Examples:
 * zipLists([]) => []
 * zipLists([[1], [2], [3]]) => [[1, 2, 3]]
 * zipLists([[1, 2], ['a', 'b']]) => [[1, 'a'], [2, 'b']]
 */
export const zipLists = <T>(l: Array<Array<T>>): Array<Array<T>> => {
    const acc: Array<T> | undefined = R.head(l);
    const data: Array<Array<T>> | undefined = R.tail(l);

    if (acc !== undefined && data !== undefined) {
        const zipped: Readonly<any[]> = R.isEmpty(data)
            ? l
            : R.reduce(R.zip, acc, data);
        return R.map(R.flatten, zipped);
    }
    return [];
};
