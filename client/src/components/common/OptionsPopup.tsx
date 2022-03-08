import React, { Component } from 'react';
import { Icon, Popup, Button } from 'semantic-ui-react';
import ClusteringAddPopup from './ClusteringAddPopup';

interface OptionsPopupState {
    optionsOpen: boolean;
    someModalOpen: boolean;
    orcid_name?: string;
    orcid_id?: string;
    orcid_uuid?: string;
}

class OptionsPopup extends Component<{}, OptionsPopupState> {
    constructor() {
        super({});
        this.state = {
            optionsOpen: false,
            someModalOpen: false,
        };
    }

    handleOpen = () => {
        this.setState({ optionsOpen: true });
    };

    handleClose = () => {
        if (!this.state.someModalOpen) {
            this.setState({ optionsOpen: false });
        }
    };

    handleModalOpen = () => {
        this.setState({ someModalOpen: true });
    };

    handleModalClose = () => {
        this.setState({ someModalOpen: false, optionsOpen: false });
    };

    render() {
        const { orcid_name, orcid_id, orcid_uuid } = this.state;

        const clusteringAdd = () => {
            if (
                orcid_name &&
                orcid_id &&
                orcid_uuid &&
                orcid_name !== '' &&
                orcid_id !== '' &&
                orcid_uuid !== ''
            ) {
                return (
                    <ClusteringAddPopup
                        handleModalOpen={this.handleModalOpen}
                        handleModalClose={this.handleModalClose}
                        orcid_name={orcid_name}
                        orcid_id={orcid_id}
                        orcid_uuid={orcid_uuid}
                    />
                );
            } else {
                return (
                    <Popup
                        position='bottom left'
                        content={
                            <b>
                                You must be logged in with an ORCID ID to add a
                                clustering! (See header)
                            </b>
                        }
                        trigger={
                            <Button color='red' inverted>
                                Add Clustering
                            </Button>
                        }
                        hoverable
                        fluid
                    />
                );
            }
        };

        return (
            <Popup
                basic
                content={clusteringAdd()}
                position='top left'
                on='click'
                open={this.state.optionsOpen}
                onClose={this.handleClose}
                onOpen={this.handleOpen}
                trigger={
                    <Icon
                        name='plus'
                        title='Additional Options'
                        style={{ display: 'inline' }}
                        className='pointer'
                    />
                }
                style={{ zIndex: 9 }}
            />
        );
    }
}

export default OptionsPopup;
