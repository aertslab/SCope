import _ from 'lodash'
import React, { Component } from 'react'
import { Grid, Input, Icon } from 'semantic-ui-react'
import { BackendAPI } from '../common/API' 

export default class ViewerSidebar extends Component {
    
    constructor() {
        super();
        this.state = {
            lassoSelections: BackendAPI.getViewerSelections()
        }
        this.selectionsListener = (selections) => {
            this.setState({lassoSelections: selections});
        }
    }

    render() {

        let lassoSelections = () => {
            if(this.state.lassoSelections.length == 0) {
                return (
                    <Grid>
                        <Grid.Column>No user's lasso selections</Grid.Column>
                    </Grid>
                );
            }
            return (this.state.lassoSelections.map((lS) => {
                return (
                    <Grid key={lS.id} columns={3}>
                        <Grid.Column>
                            {"Selection "+ lS.id}
                        </Grid.Column>
                        <Grid.Column>
                            <Input
                                size='mini'
                                style={{width: 75, height: 10}}
                                label={{ style: {backgroundColor: '#'+lS.color } }}
                                labelPosition='right'
                                placeholder={'#'+lS.color}
                            />
                        </Grid.Column>
                        <Grid.Column>
                            <Icon name='eye' style={{display: 'inline'}} onClick={(e,d) => this.toggleLassoSelection(lS.id)} style={{opacity: lS.selected ? 1 : .5 }}/>
                            <Icon name='trash' style={{display: 'inline'}} onClick={(e,d) => this.removeLassoSelection(lS.id)} />
                            <Icon name='download' style={{display: 'inline'}} onClick={(e,d) => this.downloadLassoSelection(lS.id)} />
                        </Grid.Column>
                    </Grid>
                )
            }))
        }

        return lassoSelections();
    }

    componentWillMount() {
        BackendAPI.onViewerSelectionsChange(this.selectionsListener);
    }

    componentWillUnmount() {
        BackendAPI.removeViewerSelectionsChange(this.selectionsListener);
    }

    toggleLassoSelection(id) {
        BackendAPI.toggleLassoSelection(id);
    }

    removeLassoSelection(id) {
        BackendAPI.removeViewerSelection(id);
    }

}
