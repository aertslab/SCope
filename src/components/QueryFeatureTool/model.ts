export type Feature = {
    feature: any;
};

const colors = ['red', 'green', 'blue'];

export function getChannelFromFeatureIndex(featureIndex: number): string {
    return colors[featureIndex];
}
