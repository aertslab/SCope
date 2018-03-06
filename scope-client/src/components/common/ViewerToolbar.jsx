import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import _ from 'lodash'
import React, { Component } from 'react'
import { Menu } from 'semantic-ui-react'
import Slider, { Range } from 'rc-slider';
import { BackendAPI } from '../common/API' 

export default class ViewerToolbar extends Component {
	constructor() {
		super();
		this.state = {
			activeTool: BackendAPI.getViewerTool(),
			activeFeatures: BackendAPI.getActiveFeatures(),
			activePage: BackendAPI.getActivePage(),
			featuresScale: BackendAPI.getFeaturesScale(),
			customScale: [],
			colors: BackendAPI.getColors(),

		}
		this.activeFeaturesListener = (features) => {
			this.setState({activeFeatures: features});
		}
		this.featuresScaleListener = (featuresScale, customScale) => {
			this.setState({featuresScale: featuresScale, customScale: []});
		}
	}

	render() {
		const { activeTool, activeFeatures, colors, featuresScale, customScale } = this.state;
		const createSliderWithTooltip = Slider.createSliderWithTooltip;
		const TooltipSlider = createSliderWithTooltip(Slider);
		console.log('render', featuresScale, customScale);
		let levels = false;
		let sliders = _.times(3, i => {
				let val = customScale[i] ? customScale[i] : featuresScale[i];
				if (activeFeatures[i] && activeFeatures[i].feature.length && featuresScale[i]) {
					levels = true;
					return (
						<TooltipSlider vertical key={i} 
							style={{minHeight: '400px', margin: '5px', float: 'left'}} 
							trackStyle={{background: 'linear-gradient(to top, black, '+colors[i]+')'}} 
							handleStyle={[{border: '2px solid '+colors[i]}]} 
							max={featuresScale[i]} 
							defaultValue={val}
							onAfterChange={(v) => {
								this.handleUpdateScale(i, v);
							}}
							step={0.01} 
						/>
					);
				}
			})
		let levelsHeader = levels ? <p>Expression<br />levels</p> : '';

		return (
			<div>
				<Menu style={{position: "relative", top: 0, left: 0}} vertical fluid className="toolbar" >
					<Menu.Item name='lasso' active={activeTool === 'lasso'} onClick={this.handleItemClick.bind(this)}>
						<div title="Lasso Tool" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/lasso.svg")', backgroundSize: "cover" }}></div>
					</Menu.Item>
					<Menu.Item name='s-zoom' active={activeTool === 's-zoom'} onClick={this.handleItemClick.bind(this)}>
						<div title="Semantic Zoom" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/expad-arrows.svg")', backgroundSize: "cover" }}></div>
					</Menu.Item>
				</Menu>
				<br />
				{levelsHeader}				
				<div>
					{sliders}		
				</div>
			</div>
		);
	}

	componentWillMount() {
        BackendAPI.onActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
        BackendAPI.onFeaturesScaleChange(this.featuresScaleListener);
	}

	componentWillUnmount() {
        BackendAPI.onActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
        BackendAPI.removeFeaturesScaleChange(this.featuresScaleListener);
	}

	handleItemClick(e, tool) {
		if (DEBUG) console.log("handleItemClick", tool.name);
		this.setState({ activeTool: tool.name });
		BackendAPI.setViewerTool(tool.name);
	} 

	handleUpdateScale(slider, value) {
		if (DEBUG) console.log("handleUpdateScale", slider, value);
		let scale = this.state.customScale;
		scale[slider] = value;
		_.times(3, i => {
			scale[i] = value;	
		})		
		BackendAPI.setCustomScale(scale);
		this.setState({customScale: scale});
	}
}
