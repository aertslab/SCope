import { GProfilerOrganism } from './types';

export type State = {
    error: string;
    display: boolean;
    /**
     * Array of number representing the selected gene list sizes. Theses sizes will be used to extract and c
     * create selectedTopGeneListsSizes.length gene lists that will be send to g:Profilter to perform
     * gene list functional enrichment
     */
    selectedTopGeneListsSizes: number[];
    availableOrganisms: GProfilerOrganism[];
    selectedOrganism: string;
    selectedSortBy: string;
    gProfilerToken: string;
};
