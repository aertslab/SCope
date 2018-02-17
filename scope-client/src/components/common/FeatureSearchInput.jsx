import React from 'react'
import { Search, Input, Select, Icon } from 'semantic-ui-react'

export default class FeatureSearchInput extends Search {

	renderSearchInput = () => {
		const { color, type, locked } = this.props
		const { value } = this.state
		const options = [
			{ key: 'all', text: 'all features', value: 'all' },
			{ key: 'gene', text: 'gene', value: 'gene' },
			{ key: 'regulon', text: 'regulon', value: 'regulon' },
			{ key: 'annotation', text: 'annotation', value: 'annotation' }
		]

		return (
			<div>
				<Input iconPosition='left'
					   key={color} labelPosition='left' value={value} placeholder='Search...' 
					   onChange={this.handleSearchChange}
					   onBlur={this.handleBlur}
					   onChange={this.handleSearchChange}
					   onFocus={this.handleFocus}
					   onClick={this.handleInputClick}>
					<Icon name='search' />
					<input data-mqi={color} />
					<Select options={options} defaultValue={type} className='icon' disabled={locked == 1 ? true : false} />
				</Input>
			</div>
		)
	}
}