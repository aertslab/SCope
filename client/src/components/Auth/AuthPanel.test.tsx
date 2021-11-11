/**
 * Tests for the AuthPanel component
 */

import React from 'react';

import { render, screen } from '../../test/test-utils';

import { AuthPanel } from './AuthPanel';

describe('AuthPanel component', () => {
    it('Loads and displays auth status', () => {
        render(<AuthPanel />);
        const element = screen.getByText('Auth Panel: requested_providers');

        expect(element).toBeDefined();
        expect(element).not.toBeNull();
    });

    it('Displays a Login screen when it has login providers', () => {
        render(<AuthPanel />, {
            initialState: {
                auth: {
                    status: 'have_providers',
                    providers: [
                        {
                            id: 0,
                            name: 'A',
                            icon: '',
                            url: 'login.com',
                        },
                    ],
                },
            },
        });

        const guestButton = screen.getByText('Continue as a guest user');
        expect(guestButton).toBeDefined();
        expect(guestButton).not.toBeNull();

        const loginToA = screen.getByText('A');
        expect(loginToA).toBeDefined();
        expect(loginToA).not.toBeNull();
    });

    it('Displays the username when a user is logged in', () => {
        render(<AuthPanel />, {
            initialState: {
                auth: {
                    status: 'authenticated',
                    token: '',
                    user: {
                        name: 'Test',
                        role: 'guest',
                        id: 0,
                    },
                },
            },
        });

        const element = screen.getByText('Welcome Test');
        expect(element).toBeDefined();
        expect(element).not.toBeNull();
    });
});
