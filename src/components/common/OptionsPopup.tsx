import React, { Component } from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Icon, Popup, Button } from 'semantic-ui-react';
import ClusteringAddPopup from './ClusteringAddPopup';

import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

interface OptionsPopupProps extends RouteComponentProps {
    cookies: Cookies;
}

interface OptionsPopupState {
    optionsOpen: boolean;
    cookiesAllowed: boolean;
    someModalOpen: boolean;
    orcid_name?: string;
    orcid_id?: string;
    orcid_uuid?: string;
}

class OptionsPopup extends Component<OptionsPopupProps, OptionsPopupState> {
    static propTypes = {
        cookies: instanceOf(Cookies).isRequired,
    };

    constructor(props: OptionsPopupProps) {
        super(props);
        this.state = {
            optionsOpen: false,
            cookiesAllowed: false,
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
        const { orcid_name, orcid_id, orcid_uuid, cookiesAllowed } = this.state;

        const clusteringAdd = () => {
            if (
                orcid_name &&
                orcid_id &&
                orcid_uuid &&
                orcid_name !== '' &&
                orcid_id !== '' &&
                orcid_uuid !== '' &&
                cookiesAllowed
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

    updateORCID = () => {
        const orcid_name = this.props.cookies.get('scope_orcid_name');
        const orcid_id = this.props.cookies.get('scope_orcid_id');
        const orcid_uuid = this.props.cookies.get('scope_orcid_uuid');
        let cookiesAllowed = false;
        if (this.props.cookies.get('CookieConsent') == 'true') {
            cookiesAllowed = true;
        }

        this.setState({
            orcid_name: orcid_name,
            orcid_id: orcid_id,
            orcid_uuid: orcid_uuid,
            cookiesAllowed: cookiesAllowed,
        });
    };

    componentDidMount() {
        this.updateORCID();
    }
}

export default withRouter(withCookies(OptionsPopup));
