import React, { createRef } from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Input } from 'semantic-ui-react';
import Alert from 'react-popup';

import { BackendAPI } from '../common/API';

type UpdateClusterDescriptionInputProps = {
    featureIndex: number;
    feature: any;
} & RouteComponentProps<{ uuid: string }>;

type UpdateClusterDescriptionInputState = {
    newClusterDescription: string;
};

class UpdateClusterDescriptionInput extends React.Component<
    UpdateClusterDescriptionInputProps,
    UpdateClusterDescriptionInputState
> {
    _ref: React.RefObject<Input>;

    constructor(props: UpdateClusterDescriptionInputProps) {
        super(props);
        this._ref = createRef();
        this.state = {
            newClusterDescription: '',
        };
        this.onNewAnnotationChange.bind(this);
    }

    handleAnnoUpdate = (feature: any, featureIndex: number) => {
        const { newClusterDescription } = this.state;
        const { uuid } = this.props.match.params;

        if (newClusterDescription !== '') {
            Alert.create({
                title: 'BETA: Annotation Change!',
                content: (
                    <p>
                        {[
                            'You are about to ',
                            <b>permanently</b>,
                            ' update the annotation of the existing cluster: ',
                            <br />,
                            <b>{feature.feature}</b>,
                            <br />,
                            'to the following: ',
                            <br />,
                            <b>{newClusterDescription}</b>,
                            <br />,
                            <br />,
                            <b>
                                {' '}
                                BETA: Some SCope functionality may be imparied
                                until the loom is reloaded
                            </b>,
                        ]}
                    </p>
                ),
                buttons: {
                    left: [
                        {
                            text: 'Cancel',
                            className: 'danger',
                            action: function () {
                                Alert.close();
                            },
                        },
                    ],
                    right: [
                        {
                            text: 'Save new annotation',
                            className: 'success',
                            action: () => {
                                BackendAPI.setAnnotationName(
                                    feature,
                                    newClusterDescription,
                                    featureIndex,
                                    uuid
                                );
                                Alert.close();
                            },
                        },
                    ],
                },
            });
        }
        if (newClusterDescription === '') {
            Alert.alert('You must enter a new annotation');
        }
    };

    onNewAnnotationChange = (e) => {
        this.setState({ newClusterDescription: e.target.value });
    };

    render() {
        const { featureIndex, feature } = this.props;
        const { newClusterDescription } = this.state;

        return (
            <Input
                ref={this._ref}
                style={{
                    marginBottom: '5px',
                    width: '100%',
                }}
                placeholder={feature.feature}
                onChange={this.onNewAnnotationChange}
                actionPosition='left'
                action={{
                    onClick: () => {
                        this.handleAnnoUpdate(feature, featureIndex);
                    },
                    'data-tooltip': 'PERMANENT CHANGE and forces refresh!',
                    'data-variation': 'basic',
                    'data-position': 'left center',
                    content: 'Update Description',
                }}
                value={newClusterDescription}
            />
        );
    }
}

export default withRouter(UpdateClusterDescriptionInput);
