import 'jest';

import { fetchJson } from './fetch';
import { Result, is_success, with_default, is_error, match } from '../result';

type Post = {
    id: number;
    title: string;
    body: string;
    userId: number;
};

const defaultPost = () => {
    return {
        id: 0,
        title: '',
        body: '',
        userId: 0,
    };
};

// @ts-ignore
global.fetch = jest.fn(() => {
    return Promise.resolve({
        ok: true,
        json: () =>
            Promise.resolve({
                id: 1,
                title: 'A test',
                body: 'Some text',
                userId: 5,
            }),
    });
});

beforeEach(() => {
    // @ts-ignore
    fetch.mockClear();
});

describe('Fetches JSON', () => {
    it('fetches some data', async () => {
        const result: Result<Post, string> = await fetchJson<Post>(
            'https://a.test.com/posts/1'
        );

        const post: Post = with_default(defaultPost(), result);

        expect(post.id).toBe(1);
        expect(post.title).toBe('A test');
        expect(post.body).toBe('Some text');
        expect(post.userId).toBe(5);
    });

    it('fails gracefully', async () => {
        // @ts-ignore
        fetch.mockImplementationOnce(() =>
            Promise.reject({
                ok: false,
                statusText: 'API is down',
            })
        );

        const result: Result<Post, string> = await fetchJson<Post>(
            'https://a.test.com/posts/1'
        );

        expect(is_error(result)).toBe(true);

        match(
            (post: Post): void => fail('Should not get here'),
            (msg: string): void => expect(msg).toBe('API is down'),
            result
        );
    });
});
