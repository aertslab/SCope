import React, { Component } from 'react';
import { Grid, Header } from 'semantic-ui-react';

export default class Welcome extends Component {
    render() {
        return (
            <Grid>
                <Grid.Row>
                    <Grid.Column>
                        <img
                            className='scopeLogo'
                            src='images/SCope_Logo.png'
                            width='320'
                        />
                        <br />
                        <br />
                        SCope is a fast, user-friendly visualization tool for
                        large-scale scRNA-seq datasets, published in Cell.
                        <br />
                        Datasets can be uploaded using the left sidebar. Files
                        should be in the{' '}
                        <a
                            href='http://loompy.org/'
                            target='_blank'
                            rel='noopener noreferrer'>
                            loom file format
                        </a>{' '}
                        and will appear under the &quot;User Uploaded&quot;
                        category.
                        <br />
                        SCope compatible loom files can be generated using the
                        following packages:
                        <ul>
                            <li>
                                R:{' '}
                                <a
                                    href='https://github.com/aertslab/SCopeLoomR'
                                    target='_blank'
                                    rel='noopener noreferrer'>
                                    SCopeLoomR
                                </a>
                            </li>
                            <li>
                                Python:{' '}
                                <a
                                    href='https://github.com/aertslab/pySCENIC'
                                    target='_blank'
                                    rel='noopener noreferrer'>
                                    pySCENIC
                                </a>
                            </li>
                        </ul>
                        <br />
                        Currently on{' '}
                        <a
                            href='http://scope.aertslab.org'
                            target='_blank'
                            rel='noopener noreferrer'>
                            scope.aertslab.org
                        </a>{' '}
                        the following datasets can be found preloaded in the
                        left sidebar.
                        <ul>
                            <li>
                                Drosophila
                                <ul>
                                    <li>
                                        <b>
                                            A single-cell transcriptome atlas of
                                            the ageing Drosophila brain
                                        </b>
                                        , Davie, Jannssens and Koldere{' '}
                                        <i>et al.</i>, 2018 (
                                        <a
                                            href='http://cell.com'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Cell
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Whole Adult Brain - Filtered
                                                Dataset - 57k Cells
                                            </li>
                                            <ul>
                                                <li>
                                                    <a
                                                        href='http://bit.ly/2Jzmqba'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 1a{' '}
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2JAtiEW'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 1b{' '}
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2sTN304'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 1c{' '}
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2JzUTX1'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 1d{' '}
                                                    </a>
                                                </li>
                                                <li>
                                                    <a
                                                        href='http://bit.ly/2Jzmqba'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 3a(i)
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2sU4Zrc'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 3a(ii)
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2sTmsA6'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 3a(iii)
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2JxGfj8'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 3a(iiii)
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2JzGlXl'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 3b{' '}
                                                    </a>
                                                </li>
                                                <li>
                                                    <a
                                                        href='http://bit.ly/2JAVFTy'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 4b{' '}
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2sTmZlA'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 4c{' '}
                                                    </a>
                                                    ,{' '}
                                                    <a
                                                        href='http://bit.ly/2sP38Ef'
                                                        target='_blank'
                                                        rel='noopener noreferrer'>
                                                        Fig. 4d{' '}
                                                    </a>
                                                </li>
                                            </ul>
                                            <li>
                                                Whole Adult Brain - Unfiltered
                                                Dataset - 157k Cells
                                            </li>
                                            <li>
                                                Whole Adult Brain - Drop-seq
                                                Dataset - 2k Cells
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <b>
                                            Phenotypic convergence: distinct
                                            transcription factors regulate
                                            common terminal features
                                        </b>
                                        , Konstantinides <i>et al.</i>, 2018 (
                                        <a
                                            href='https://doi.org/10.1016/j.cell.2018.05.021'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Cell
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Adult Optic Lobe - Filtered
                                                Dataset - 57k Cells
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <b>
                                            Cellular diversity in the Drosophila
                                            midbrain revealed by single-cell
                                            transcriptomics
                                        </b>
                                        , Croset, Treiber and Waddell, 2018 (
                                        <a
                                            href='https://doi.org/10.7554/eLife.34550'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            eLife
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Adult Central Brain - Filtered
                                                Dataset - 10k Cells
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <b>
                                            Classifying Drosophila Olfactory
                                            Projection Neuron Subtypes by
                                            Single-Cell RNA Sequencing
                                        </b>
                                        , Li and Horns <i>et al.</i>, 2017 (
                                        <a
                                            href='https://doi.org/10.1016/j.cell.2017.10.019'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Cell
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Pupal and Adult Olfactory
                                                Projection Neurons - Filtered
                                                Dataset - 500 Cells
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <b>
                                            The Drosophila embryo at single-cell
                                            transcriptome resolution
                                        </b>
                                        , Karaiskos <i>et al.</i>, 2017 (
                                        <a
                                            href='https://doi.org/10.1126/science.aan3235'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Science
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Whole Embryo - Filtered Dataset
                                                - 6k Cells
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                            <li>
                                Mouse
                                <ul>
                                    <li>
                                        <b>
                                            Brain structure. Cell types in the
                                            mouse cortex and hippocampus
                                            revealed by single-cell RNA-seq
                                        </b>
                                        , Zeisel <i>et al.</i>, 2015 (
                                        <a
                                            href='http://science.sciencemag.org/content/347/6226/1138'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Science
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Somatosensory cortex and
                                                hippocampal CA1 regions. -
                                                Filtered Dataset - 3k Cells
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <b>
                                            Single-Cell RNA-Seq Reveals
                                            Hypothalamic Cell Diversity
                                        </b>
                                        , Chen, Wu, Jiang and Zhang, 2017 (
                                        <a
                                            href='https://doi.org/10.1016/j.celrep.2017.03.004'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Cell Reports
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Hypothalamus - Filtered Dataset
                                                - 3k Cells
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                            <li>
                                Human
                                <ul>
                                    <li>
                                        <b>
                                            Integrative single-cell analysis of
                                            transcriptional and epigenetic
                                            states in the human adult brain
                                        </b>
                                        , Lake <i>et al.</i>, 2018 (
                                        <a
                                            href='http://doi.org/10.1038/nbt.4038'
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            Nature Biotechnology
                                        </a>
                                        )
                                        <ul>
                                            <li>
                                                Adult visual cortex, frontal
                                                cortex, and cerebellum -
                                                Filtered Dataset - 60k Cells
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                        <br />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}
