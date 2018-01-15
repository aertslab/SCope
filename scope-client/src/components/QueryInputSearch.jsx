import React, { Component, PropTypes } from 'react'
import { Search, Input, Dropdown, Label, Select, Button, Checkbox, Menu, Icon } from 'semantic-ui-react'

export default class QuerySearch extends Search {

    constructor(props) {
        super(props)
    }

    // Overide Search Input
    renderSearchInput = () => {
        const { icon, placeholder } = this.props
        const { value } = this.state
        const options = [
            { key: 'all', text: 'all features', value: 'all' },
            { key: 'gene', text: 'gene', value: 'gene' },
            { key: 'regulon', text: 'regulon', value: 'regulon' },
            { key: 'annotation', text: 'annotation', value: 'annotation' }
        ]

        let tag = () => {
            if(this.props.multiqueryon == "true")
                return <Label color={this.props.color} style={{position: 'relative', left: 10}}></Label>
        }

        return (
            <div>
                { tag() }
                <Input iconPosition='left'
                       key={this.props.color} labelPosition='left' type='text' value={value} placeholder='Search...' action
                       onChange={this.handleSearchChange}
                       onBlur={this.handleBlur}
                       onChange={this.handleSearchChange}
                       onFocus={this.handleFocus}
                       onClick={this.handleInputClick}>
                    <Icon name='search'/>
                    <input data-mqi={this.props.color}/>
                    <Select options={options} defaultValue='all' className='icon'/>
                </Input>
            </div>
        )
    }
}