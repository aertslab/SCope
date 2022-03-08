import React from 'react';
import { Button, Progress } from 'semantic-ui-react';

import FileDownloader from '../../js/http';
import { BackendAPI } from '../common/API';

declare const DEBUG: boolean;

type DownloadLoomButtonProps = {
    activeFeature: any;
};

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
            loomDownloading: '',
            processLoomPercentage: -1,
            downloadLoomPercentage: -1,
        };
    }

    progressListener(call) {
        //TODO: `uuid` is no longer a valid concept
        const uuid = null;
        call.on('data', (loomDownloader) => {
            if (DEBUG) {
                console.log('downloadSubLoom data');
            }
            if (loomDownloader === null) {
                this.setState({
                    loomDownloading: '',
                    downloadLoomPercentage: -1,
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
                const fd = new FileDownloader(
                    loomDownloader.loomFilePath,
                    uuid,
                    loomDownloader.loomFileSize
                );
                fd.on('started', () => {
                    this.setState({
                        processLoomPercentage: 0,
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
                        loomDownloading: '',
                        downloadLoomPercentage: -1,
                    });
                });
                fd.start();
            }
        });
        call.on('end', () => {
            console.log();
            if (DEBUG) {
                console.log('downloadSubLoom end');
            }
        });
    }

    render() {
        const { activeFeature } = this.props;
        const { processLoomPercentage, downloadLoomPercentage } = this.state;

        if (this.state.processLoomPercentage > 0) {
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
        }
        if (processLoomPercentage > 0) {
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
        }
        if (downloadLoomPercentage < 0 && processLoomPercentage < 0) {
            return (
                <Button
                    color='green'
                    onClick={() => {
                        const query = {
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
                                if (DEBUG) {
                                    console.log(
                                        'Download subset of active .loom'
                                    );
                                }
                                const call =
                                    gbc.services.scope.Main.downloadSubLoom(
                                        query
                                    );
                                this.progressListener(call);
                            },
                            () => {
                                this.setState({
                                    loomDownloading: '',
                                    downloadLoomPercentage: -1,
                                    processLoomPercentage: -1,
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
}

export default DownloadLoomButton;
