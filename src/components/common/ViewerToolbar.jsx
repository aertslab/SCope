import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import _ from 'lodash';
import React, { Component } from 'react';
import { Menu, Grid } from 'semantic-ui-react';
import Slider, { Range } from 'rc-slider';
import { BackendAPI } from '../common/API';
import ReactGA from 'react-ga';

const createSliderWithTooltip = Slider.createSliderWithTooltip;
const TooltipSlider = createSliderWithTooltip(Slider);

export default class ViewerToolbar extends Component {
    constructor() {
        super();
        this.state = {
            activeTool: BackendAPI.getViewerTool(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            activePage: BackendAPI.getActivePage(),
            featuresScale: BackendAPI.getFeatureScale(),
            customScale: BackendAPI.getCustomScale(),
            colors: BackendAPI.getColors()
        };
        this.activeFeaturesListener = (
            features,
            id,
            customScale,
            featuresScale
        ) => {
            this.setState({
                activeFeatures: features,
                featuresScale: featuresScale,
                customScale: customScale
            });
        };
        this.featuresScaleListener = (featuresScale) => {
            this.setState({ featuresScale: featuresScale });
        };
        this.settingsListener = (settings, customScale, featuresScale) => {
            this.setState({
                featuresScale: featuresScale,
                customScale: customScale
            });
        };
    }

    render() {
        const {
            activeTool,
            activeFeatures,
            colors,
            featuresScale,
            customScale
        } = this.state;

        let levels = false;
        let sliders = _.times(3, (i) => {
            let val = customScale[i] ? customScale[i] : featuresScale[i];
            if (
                activeFeatures[i] &&
                activeFeatures[i].feature.length &&
                featuresScale[i]
            ) {
                levels = true;
                return (
                    <TooltipSlider
                        vertical
                        key={i}
                        style={{
                            minHeight: '400px',
                            margin: '5px',
                            float: 'left'
                        }}
                        trackStyle={{
                            background:
                                'linear-gradient(to top, black, ' +
                                colors[i] +
                                ')'
                        }}
                        handleStyle={[{ border: '2px solid ' + colors[i] }]}
                        max={featuresScale[i]}
                        defaultValue={val}
                        onAfterChange={(v) => {
                            this.handleUpdateScale(i, v);
                        }}
                        min={featuresScale[i] / 1000}
                        step={featuresScale[i] / 1000}
                        tipFormatter={(v) => {
                            return v.toFixed(3);
                        }}
                    />
                );
            }
        });
        let levelsHeader = levels ? (
            <p>
                Expression
                <br />
                levels
            </p>
        ) : (
            ''
        );

        return (
            <Grid>
                <Grid.Row>
                    <Menu
                        style={{ position: 'relative', top: 0, left: 0 }}
                        vertical
                        fluid
                        className='toolbar'>
                        <Menu.Item
                            name='lasso'
                            active={activeTool === 'lasso'}
                            onClick={this.handleItemClick.bind(this)}>
                            <div
                                title='Lasso Tool'
                                style={{
                                    display: 'block',
                                    width: 20,
                                    height: 20,
                                    backgroundImage:
                                        'url("src/images/lasso.svg")',
                                    backgroundSize: 'cover'
                                }}></div>
                        </Menu.Item>
                        <Menu.Item
                            name='s-zoom'
                            active={activeTool === 's-zoom'}
                            onClick={this.handleItemClick.bind(this)}>
                            <div
                                title='Semantic Zoom'
                                style={{
                                    display: 'block',
                                    width: 20,
                                    height: 20,
                                    backgroundImage:
                                        'url("src/images/expad-arrows.svg")',
                                    backgroundSize: 'cover'
                                }}></div>
                        </Menu.Item>
                    </Menu>
                </Grid.Row>
                <Grid.Row>{levelsHeader}</Grid.Row>
                <Grid.Row>{sliders}</Grid.Row>
            </Grid>
        );
    }

    componentWillMount() {
        BackendAPI.onActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
        BackendAPI.onSettingsChange(this.settingsListener);
        BackendAPI.onFeatureScaleChange(this.featuresScaleListener);
        //this.onActiveFeaturesChange(this.state.activeFeatures);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
        BackendAPI.removeSettingsChange(this.settingsListener);
        BackendAPI.removeFeatureScaleChange(this.featuresScaleListener);
    }

    handleItemClick(e, tool) {
        if (DEBUG) console.log('handleItemClick', tool.name);
        this.setState({ activeTool: tool.name });
        BackendAPI.setViewerTool(tool.name);
        ReactGA.event({
            category: 'viewer',
            action: 'selected tool',
            label: tool.name
        });
    }

    handleUpdateScale(slider, value) {
        let scale = this.state.customScale;
        scale[slider] = value;
        if (DEBUG) console.log('handleUpdateScale', slider, value, scale);
        BackendAPI.setCustomScale(scale, slider);
        this.setState({ customScale: scale });
        ReactGA.event({
            category: 'viewer',
            action: 'expression level changed',
            value: slider
        });
    }
}
