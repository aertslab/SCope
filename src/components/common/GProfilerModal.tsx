import _ from 'lodash';
import { BackendAPI } from './API';
import { withRouter } from 'react-router-dom';

import React, { Component } from 'react';
import { Button, Modal, Form, Checkbox } from 'semantic-ui-react';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

interface IState {
    showModal: boolean;
}

interface TProps {
    numFeatures: number;
    clusteringID: number;
    clusterID: number;
    cookies: Cookies;
}

class GProfilerPopup extends Component<TProps, IState> {
    static propTypes = {
        cookies: instanceOf(Cookies).isRequired,
    };

    constructor(props: TProps) {
        super(props);
        this.state = {
            showModal: false,
        };
    }

    openModal = () => {
        this.setState({ showModal: true });
    };

    closeModal = () => {
        this.setState({ showModal: false });
    };

    render() {
        const { showModal } = this.state;

        let cardStyle = {
            display: 'block',
            width: '100vw',
            transitionDuration: '0.3s',
        };

        const handleOpenModal = () => {
            this.openModal();
        };

        const handleCloseModal = () => {
            this.closeModal();
        };

        const topNumFeaturesArray = [
            100,
            200,
            300,
            400,
            500,
        ].filter((topNumFeatures) =>
            topNumFeatures < this.props.numFeatures ? true : false
        );

        return (
            <>
                <Modal
                    as={Form}
                    trigger={
                        <Button
                            color='orange'
                            onClick={handleOpenModal}
                            style={{
                                marginTop: '10px',
                                marginBottom: '10px',
                                width: '100%',
                            }}>
                            Run g:Profiler Gene List Enrichment
                        </Button>
                    }
                    onClose={handleCloseModal}
                    // closeOnDocumentClick={'ready' == this.state.status}
                    open={showModal}
                    // onSubmit={e => {this.sendData(e)}}
                >
                    <Modal.Header>
                        Run g:Profiler Gene List Enrichment
                    </Modal.Header>
                    <Modal.Content>
                        <Modal.Description>
                            <div>Run As Multi-query</div>
                            <div>
                                Totral number of features detected:
                                {this.props.numFeatures}
                            </div>
                            {topNumFeaturesArray.map((topNumFeatures) => {
                                return (
                                    <Checkbox
                                        label={`Top ${topNumFeatures}`}
                                        // onChange={this.toggle}
                                        // checked={this.state.checked}
                                    />
                                );
                            })}
                        </Modal.Description>
                    </Modal.Content>
                    <Modal.Actions>
                        {
                            <Button
                                type='button'
                                value='create-gprofiler-link'
                                // onClick={(e) => this.sendData(e)}
                                // disabled={this.getButtonDisabledStatus()}
                                secondary>
                                {'Create Link'}
                            </Button>
                        }
                        {
                            <Button
                                type='button'
                                value='goto-gprofiler'
                                // onClick={(e) => this.sendData(e)}
                                // disabled={this.getButtonDisabledStatus()}
                                primary>
                                {'Go to g:Profiler'}
                            </Button>
                        }
                    </Modal.Actions>
                </Modal>
            </>
        );
    }
}

export default withCookies(withRouter(GProfilerPopup));
