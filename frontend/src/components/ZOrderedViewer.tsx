import { useMemo } from 'react'
import { ThreeViewer } from './ThreeViewer'
import { ViewerSettings } from './SettingsPanel'
import { Selection } from '../types'

interface ZOrderedViewerProps {
    embeddingData: { X: number[] | Float32Array, Y: number[] | Float32Array, Z: number[] | Float32Array },
    displayColours: any,
    customColors: Float32Array | null,
    sizes: number | number[],
    opacities: number | number[],
    settings: ViewerSettings,
    selections: Selection[],
    selectedLegendItems: string[],
    rawValues: any[],
    activeColorInfo: {name: string, type: string} | null,
    colorRanges?: Record<string, [number, number]>
}

export const ZOrderedViewer = ({ 
    embeddingData, 
    displayColours, 
    customColors, 
    sizes, 
    opacities, 
    settings, 
    selections,
    selectedLegendItems,
    rawValues,
    activeColorInfo,
    colorRanges
}: ZOrderedViewerProps) => {
    const zAdjustedData = useMemo(() => {
        if (!settings.zOrdering) return embeddingData;

        const count = embeddingData.X.length;
        const newZ = new Float32Array(count);
        
        // 1. Base Z (from embedding or 0)
        for(let i=0; i<count; i++) {
            newZ[i] = (embeddingData.Z && embeddingData.Z[i]) ? embeddingData.Z[i] : 0;
        }

        // 2. Expression Boost (0..0.5)
        // Sum normalized expression values if genes are selected
        
        let hasExpression = false;
        const expressionSum = new Float32Array(count);
        
        Object.keys(displayColours).forEach(key => {
            const arr = displayColours[key];
            if (arr && arr.length === count) {
                hasExpression = true;
                for(let i=0; i<count; i++) {
                    expressionSum[i] += arr[i];
                }
            }
        });

        if (hasExpression) {
            let maxExp = 0;
            for(let i=0; i<count; i++) {
                if (expressionSum[i] > maxExp) maxExp = expressionSum[i];
            }
            if (maxExp > 0) {
                for(let i=0; i<count; i++) {
                    newZ[i] += (expressionSum[i] / maxExp) * 0.5;
                }
            }
        }

        // 3. Selection Boost (+1.0)
        // Lasso Selections
        if (selections.length > 0) {
            const selectedIndices = new Set<number>();
            selections.forEach(s => {
                if (s.visible) {
                    s.indices.forEach(idx => selectedIndices.add(idx));
                }
            });
            selectedIndices.forEach(idx => {
                if (idx < count) newZ[idx] += 1.0;
            });
        }

        // Legend Selections
        if (selectedLegendItems.length > 0 && activeColorInfo?.type === 'categorical') {
            // rawValues contains the category labels
            for(let i=0; i<count; i++) {
                if (selectedLegendItems.includes(String(rawValues[i]))) {
                    newZ[i] += 1.0;
                }
            }
        }

        return {
            X: embeddingData.X,
            Y: embeddingData.Y,
            Z: newZ
        };

    }, [embeddingData, settings.zOrdering, displayColours, selections, selectedLegendItems, rawValues, activeColorInfo]);

    return (
        <ThreeViewer
            data={zAdjustedData}
            colours={displayColours}
            customColors={customColors}
            size={sizes}
            opacities={opacities}
            shape={settings.shape}
            selections={selections}
            colorRanges={colorRanges}
        />
    );
};
