import React from 'react';

import { imageExists, getMotifLogoURL } from './model';

type MotifLogoProps = {
    motifName: string;
};

type MotifLogoState = {
    loading: boolean;
    motifLogoURL: string | null;
};

export class MotifLogo extends React.Component<MotifLogoProps, MotifLogoState> {
    constructor(props: MotifLogoProps) {
        super(props);
        this.state = {
            loading: true,
            motifLogoURL: null,
        };
    }

    isMotifNA() {
        return this.props.motifName === 'NA.png';
    }

    async componentDidMount() {
        if (this.isMotifNA()) {
            return;
        }

        const { motifName } = this.props;
        const motifLogoV9URL = getMotifLogoURL(motifName, 9);
        if (await imageExists(motifLogoV9URL)) {
            this.setState({
                motifLogoURL: motifLogoV9URL,
            });
        }
        const motifLogoV8URL = getMotifLogoURL(motifName, 8);
        if (await imageExists(motifLogoV8URL)) {
            this.setState({
                motifLogoURL: motifLogoV8URL,
            });
        }
        this.setState({ loading: false });
    }

    render() {
        if (this.isMotifNA()) {
            return <span>Motif logo unavailable</span>;
        }
        const { motifName } = this.props;
        const { loading, motifLogoURL } = this.state;
        if (loading) {
            return <span>{`Loading ${motifName}...`}</span>;
        }
        if (motifLogoURL) {
            return <img src={motifLogoURL} />;
        }
        return <span>{`Motif logo ${motifName} unavailable`}</span>;
    }
}
