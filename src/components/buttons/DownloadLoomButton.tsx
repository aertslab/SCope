import React from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Button, Progress } from 'semantic-ui-react';

import FileDownloader from '../../js/http';
import { BackendAPI } from '../common/API';

declare const DEBUG: boolean;

type DownloadLoomButtonProps = { activeFeature: any } & RouteComponentProps<{
    uuid: string;
}>;

type DownloadLoomButtonState = {
    loomDownloading: string;
    processLoomPercentage: number;
    downloadLoomPercentage: number;
};

class DownloadLoomButton extends React.Component<
    DownloadLoomButtonProps,
    DownloadLoomButtonState
> {
    constructor(props: DownloadLoomButtonProps) {
        super(props);
        this.state = {
            loomDownloading: null,
            processLoomPercentage: null,
            downloadLoomPercentage: null,
        };
    }

    progressListener(call) {
        const {
            match: {
                params: { uuid },
            },
        } = this.props;

        call.on('data', (loomDownloader) => {
            if (DEBUG) console.log('downloadSubLoom data');
            if (loomDownloader == null) {
                this.setState({
                    loomDownloading: null,
                    downloadLoomPercentage: null,
                });
                return;
            }
            if (!loomDownloader.isDone) {
                this.setState({
                    processLoomPercentage: Math.round(
                        loomDownloader.progress.value * 100
                    ),
                });
            } else {
                // Start downloading the subsetted loom file
                let fd = new FileDownloader(
                    loomDownloader.loomFilePath,
                    uuid,
                    loomDownloader.loomFileSize
                );
                fd.on('started', () => {
                    this.setState({
                        processLoomPercentage: null,
                        loomDownloading: encodeURIComponent(
                            loomDownloader.loomFilePath
                        ),
                    });
                });
                fd.on('progress', (progress) => {
                    this.setState({
                        downloadLoomPercentage: progress,
                    });
                });
                fd.on('finished', () => {
                    this.setState({
                        loomDownloading: null,
                        downloadLoomPercentage: null,
                    });
                });
                fd.start();
            }
        });
        call.on('end', () => {
            console.log();
            if (DEBUG) console.log('downloadSubLoom end');
        });
    }

    render() {
        const { activeFeature } = this.props;
        const { processLoomPercentage, downloadLoomPercentage } = this.state;

        if (this.state.processLoomPercentage > 0)
            return (
                <Progress
                    percent={processLoomPercentage}
                    indicating
                    progress
                    disabled
                    size='large'>
                    Processing...
                </Progress>
            );
        if (processLoomPercentage > 0)
            return (
                <Progress
                    percent={downloadLoomPercentage}
                    indicating
                    progress
                    disabled
                    size='large'>
                    Downloading...
                </Progress>
            );
        if (downloadLoomPercentage == null && processLoomPercentage == null)
            return (
                <Button
                    color='green'
                    onClick={() => {
                        let query = {
                            loomFilePath: BackendAPI.getActiveLoom(),
                            featureType: 'clusterings',
                            featureName: activeFeature.featureType.replace(
                                /Clustering: /g,
                                ''
                            ),
                            featureValue: activeFeature.feature,
                            operator: '==',
                        };
                        BackendAPI.getConnection().then(
                            (gbc) => {
                                if (DEBUG)
                                    console.log(
                                        'Download subset of active .loom'
                                    );
                                let call = gbc.services.scope.Main.downloadSubLoom(
                                    query
                                );
                                this.progressListener(call);
                            },
                            () => {
                                this.setState({
                                    loomDownloading: null,
                                    downloadLoomPercentage: null,
                                    processLoomPercentage: null,
                                });
                                BackendAPI.showError();
                            }
                        );
                    }}
                    style={{
                        marginTop: '10px',
                        width: '100%',
                    }}>
                    {'Download ' + activeFeature.feature + ' .loom file'}
                </Button>
            );
    }
}

export default withRouter(DownloadLoomButton);
