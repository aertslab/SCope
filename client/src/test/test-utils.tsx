import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import reducer from '../redux/reducers';

function render(
    ui,
    {
        initialState = {},
        store = createStore(reducer, initialState),
        ...renderOptions
    } = {}
) {
    const wrapper: React.FC = ({ children }) => {
        return <Provider store={store}>{children}</Provider>;
    };
    return rtlRender(ui, { wrapper, ...renderOptions });
}

// re-export everything
export * from '@testing-library/react';
// override render method
export { render };
