import React from 'react';

import { Tab } from 'semantic-ui-react';

import { LassoSelection } from './model';
import { LassoSelectionPane } from './LassoSelectionPane';

type LassoTabProps = {
    selections: LassoSelection[];
};

export class LassoTab extends React.Component<LassoTabProps> {
    constructor(props: LassoTabProps) {
        super(props);
    }

    render() {
        const { selections } = this.props;
        if (selections.length == 0) {
            return (
                <Tab.Pane attached={false} style={{ textAlign: 'center' }}>
                    <br />
                    <br />
                    No user&apos;s lasso selections
                    <br />
                    <br />
                    <br />
                </Tab.Pane>
            );
        }

        return selections.map(
            (lassoSelection: LassoSelection, index: number) => {
                return <LassoSelectionPane idx={index} {...lassoSelection} />;
            }
        );
    }
}
