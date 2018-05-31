import _ from 'lodash'
import React from 'react'
import { Search, Input, Select, Icon } from 'semantic-ui-react'

export default class FeatureSearchInput extends Search {

	renderSearchInput = () => {
		const { color, type, inputLocked, selectLocked } = this.props
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
			<Input key={color}
				fluid
				iconPosition='left'
				labelPosition='left' 
				value={value} 
				placeholder='Search...' 
				onChange={(evt, input) => {
					evt.persist();
					this.setState({value: evt.target.value});
					this.props.stopRequest();
					this.handleSearchChangeDebounced.cancel();
					this.handleSearchChangeDebounced(evt, input);
				}}
				onBlur={this.handleBlur}
				onFocus={this.handleFocus}
				onClick={this.handleInputClick}
			>
				<Icon name='search' />
				<input disabled={inputLocked}/>
				<Select options={options} 
					defaultValue={type} 
					className='icon typeSelect' 
					disabled={selectLocked} 
					onChange={this.handleTypeChange.bind(this)} 
					tabIndex={-1} 					
				/>
			</Input>
		)
	}

	componentWillMount() {
		this.handleSearchChangeDebounced = _.debounce((evt, input) => {
			this.handleSearchChange(evt, input);
		}, 750);
	}

	handleTypeChange(proxy, select) {
		this.props.handleTypeChange(select.value);
	}
}