import React, { Component, PropTypes } from 'react'
import { Search, Input, Dropdown } from 'semantic-ui-react'

export default class QuerySearch extends Search {

    constructor(props) {
        super(props)
    }

    // Overide Search Input
    renderSearchInput = () => {
        const { icon, placeholder } = this.props
        const { value } = this.state
        const options = [
            { key: 'page', text: 'This Page', value: 'page' },
            { key: 'org', text: 'This Organization', value: 'org' },
            { key: 'site', text: 'Entire Site', value: 'site' },
        ]

        return (
            <Input
                action={<Dropdown button basic floating options={options} defaultValue='page' />}
                icon='search'
                iconPosition='left'
                value={value}
                placeholder='Search...'
                onBlur={this.handleBlur}
                onChange={this.handleSearchChange}
                onFocus={this.handleFocus}
                onClick={this.handleInputClick}
                // input={{ className: 'prompt', tabIndex: '0', autoComplete: 'off' }}
                icon={icon}
            />
        )
    }
}