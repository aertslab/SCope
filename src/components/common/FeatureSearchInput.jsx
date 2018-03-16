import React from 'react'
import { Search, Input, Select, Icon } from 'semantic-ui-react'

export default class FeatureSearchInput extends Search {

	renderSearchInput = () => {
		const { color, type, locked } = this.props
		const { value } = this.state		
		let options = this.props.options;
		if (!options) {
			options = [
				{ key: 'all', text: 'all features', value: 'all' },
				{ key: 'gene', text: 'gene', value: 'gene' },
				{ key: 'regulon', text: 'regulon', value: 'regulon' },
				{ key: 'cluster', text: 'cluster', value: 'cluster' }
			]
		}

		return (
			<div>
				<Input iconPosition='left'
					   key={color} labelPosition='left' value={value} placeholder='Search...' 
					   onChange={this.handleSearchChange}
					   onBlur={this.handleBlur}
					   onFocus={this.handleFocus}
					   onClick={this.handleInputClick}>
					<Icon name='search' />
					<input data-mqi={color} />
					<Select options={options} defaultValue={type} className='icon' disabled={locked == 1 ? true : false} onChange={this.handleTypeChange.bind(this)} tabIndex={-1} />
				</Input>
			</div>
		)
	}

	handleTypeChange(proxy, select) {
		this.props.handleTypeChange(select.value);
	}
}