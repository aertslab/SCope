interface IGVPanelProps {
    datasetId: string;
}

export default function IGVPanel({ datasetId }: IGVPanelProps) {
    return (
        <div className="h-full w-full bg-gray-900 flex items-center justify-center text-white border border-gray-700">
            <div className="text-center">
                <h2 className="text-xl font-bold mb-2">IGV Viewer</h2>
                <p className="text-gray-400">Coming soon for dataset: {datasetId}</p>
            </div>
        </div>
    );
}
