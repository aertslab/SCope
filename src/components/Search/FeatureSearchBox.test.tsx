/**
 * This module is intended to test user interaction with the FeatureSearchBox component
 */

import React from 'react';

import { render, fireEvent, screen, waitFor } from '@testing-library/react';

import { FeatureSearchBox } from './FeatureSearchBox';

import { FeatureFilter } from './model';

describe('FeatureSearchBox component', () => {
    const mockProps = {
        field: 'test',
        filter: 'all' as FeatureFilter,
        colour: 'red',
        search: jest.fn((field, filter, query) => query),
        selectResult: jest.fn((field, selection) => selection.title),
    };

    it('Loads and displays a search box', () => {
        render(<FeatureSearchBox {...mockProps} />);
    });

    it('Fires a search when the user types', () => {
        render(<FeatureSearchBox {...mockProps} />);

        fireEvent.change(screen.getByPlaceholderText('Search...'), {
            target: { value: 'a' },
        });

        expect(mockProps.search.mock.results[0].value).toBe('a');
    });

    it('Fires a select action when the user selects a result', async () => {
        render(
            <FeatureSearchBox
                results={[
                    {
                        category: 'hello',
                        results: [{ title: 'a', description: '' }],
                    },
                ]}
                value='a'
                {...mockProps}
            />
        );

        fireEvent.click(screen.getByText('a'));

        expect(mockProps.selectResult.mock.results[0].value).toBe('a');
    });
});
