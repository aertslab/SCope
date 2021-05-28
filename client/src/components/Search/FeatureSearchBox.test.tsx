/**
 * This module is intended to test user interaction with the FeatureSearchBox component
 */

import React from 'react';

import { render, fireEvent, screen, waitFor } from '../../test/test-utils';

import { FeatureSearchBox } from './FeatureSearchBox';

import { FeatureFilter } from './model';

describe('FeatureSearchBox component', () => {
    const mockProps = {
        field: 'test',
        filter: 'all' as FeatureFilter,
        colour: 'red',
    };

    it('Loads and displays a search box', () => {
        render(<FeatureSearchBox {...mockProps} />);

        expect(
            (screen.getByPlaceholderText('Search...') as HTMLInputElement).value
        ).toEqual('');
    });

    it('Changes the displayed text when the user types', () => {
        render(<FeatureSearchBox {...mockProps} />);

        fireEvent.change(screen.getByPlaceholderText('Search...'), {
            target: { value: 'a' },
        });

        expect(
            (screen.getByPlaceholderText('Search...') as HTMLInputElement).value
        ).toEqual('a');
    });

    it('Changes the displayed text when the user selects a result', async () => {
        const initialState = {
            search: {
                test: {
                    field: 'test',
                    loading: false,
                    value: 'a',
                    results: [
                        {
                            category: 'hello',
                            results: [{ title: 'abc', description: '' }],
                        },
                    ],
                    selected: undefined,
                    error: undefined,
                },
            },
        };
        render(<FeatureSearchBox {...mockProps} />, { initialState });

        fireEvent.click(screen.getByText('abc'));

        expect(
            (screen.getByPlaceholderText('Search...') as HTMLInputElement).value
        ).toEqual('abc');
    });
});
