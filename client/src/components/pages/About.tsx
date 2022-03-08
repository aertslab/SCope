import React from 'react';

export const About: React.FC<{}> = () => {
    return (
        <div
            style={{
                display: 'grid',
                alignContent: 'baseline',
            }}>
            <h1>About SCope</h1>
            <p>
                The original version of SCope was designed and developed by
                Maxime De Waegeneer. The current version was made as a joint
                effort of{' '}
                <a href='https://aertslab.org'>
                    Laboratory of Computation Biology
                </a>{' '}
                from{' '}
                <a href='https://cbd.vib.be/'>
                    VIB-KU Leuven Center for Brain & Disease Research
                </a>{' '}
                and the{' '}
                <a href='https://www.bits.vib.be'>VIB Bioinformatics Core</a>.
            </p>
            <p>
                The developers team: <b>Kristofer Davie</b>{' '}
                <em>&lt;kristofer.davie@kuleuven.vib.be&gt;</em>,{' '}
                <b>Maxime De Waegeneer</b>{' '}
                <em>&lt;maxime.dewaegeneer@kuleuven.vib.be&gt;</em>,{' '}
                <b>Łukasz Kreft</b> <em>&lt;lukasz.kreft@vib.be&gt;</em>
            </p>
            <p>
                SCope is licensed under{' '}
                <a href='https://www.gnu.org/licenses/gpl-3.0.en.html'>
                    GPL-3.0
                </a>
            </p>
            <p>
                The source code is available from{' '}
                <a href='https://github.com/aertslab/SCope'>
                    https://github.com/aertslab/SCope
                </a>
            </p>
            <p>
                Datasets present in this tool were made using{' '}
                <a href='https://aertslab.org/#scenic'>SCENIC workflow</a>.
            </p>
            <p>This website uses cookies.</p>
            <p style={{ display: 'flex', justifyContent: 'center' }}>
                <a href='http://kuleuven.be'>
                    <img
                        src='src/images/kuleuven.png'
                        height='50'
                        alt='KU Leuven logo'
                    />
                </a>
            </p>
            <p style={{ display: 'flex', justifyContent: 'center' }}>
                <a href='http://vib.be'>
                    <img src='src/images/vib.png' height='50' alt='VIB logo' />
                </a>
            </p>
            <p style={{ display: 'flex', justifyContent: 'center' }}>
                <a href='http://flycellatlas.org/'>
                    <img
                        src='src/images/flycellatlas.png'
                        height='100'
                        alt='Fly Cell Atlas logo'
                    />
                </a>
            </p>
        </div>
    );
};
