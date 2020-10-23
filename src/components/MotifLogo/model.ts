export async function imageExists(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok;
    } catch (error) {
        console.log(`Image does not exist at ${url}: ${error}`);
        return false;
    }
}

const MOTIF_COLLECTIONS_V8_LOGOS_URL =
    'http://motifcollections.aertslab.org/v8/logos';
const MOTIF_COLLECTIONS_V9_LOGOS_URL =
    'http://motifcollections.aertslab.org/v9/logos';

export function getMotifLogoURL(motifName: string, version: number) {
    switch (version) {
        case 8:
            return `${MOTIF_COLLECTIONS_V8_LOGOS_URL}/${motifName}`;
        case 9:
        default:
            return `${MOTIF_COLLECTIONS_V9_LOGOS_URL}/${motifName}`;
    }
}
