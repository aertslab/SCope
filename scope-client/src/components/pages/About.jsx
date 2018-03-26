import React, { Component } from 'react'
import { Grid, Header, Image } from 'semantic-ui-react'

export default class About extends Component {

    render() {
        return (
            <Grid>
                <Grid.Row>
                    <Grid.Column>
                        <Header as='h1'>About SCope</Header>
                        SCope was made as a joint effort of <a href='https://aertslab.org'>Laboratory of Computation Biology</a> from <a href='https://cbd.vib.be/'>VIB-KU Leuven Center for Brain & Disease Research</a> and the <a href='https://www.bits.vib.be'>VIB Bioinformatics Core</a>.<br />
                        The developers team: <b>Kristofer Davie</b> <em>&lt;kristofer.davie@kuleuven.vib.be&gt;</em>, <b>Maxime De Waegeneer</b> <em>&lt;maxime.dewaegeneer@kuleuven.vib.be&gt;</em>, <b>Łukasz Kreft</b> <em>&lt;lukasz.kreft@vib.be&gt;</em><br />
                        The supervising PI: <b>Stein Aerts</b> <em>&lt;stein.aerts@kuleuven.vib.be&gt;</em><br /><br />
                        SCope is licensed under <a href='https://www.gnu.org/licenses/gpl-3.0.en.html'>GPL-3.0</a><br />
                        The source code is available under <a href='https://github.com/aertslab/SCope'>https://github.com/aertslab/SCope</a><br />
                        This software makes use of open source packages (i.e. <a href='https://www.npmjs.com/package/caniuse-db'>caniuse-db</a>) and standards (i.e. <a href='https://www.npmjs.com/package/spdx-expression-parse' >SPDX</a>).<br />
                        Refer to the source code for the complete list.<br />
                        This website uses cookies.<br /><br /><br />
                        <a href='http://kuleuven.be'><Image src='src/images/vib.png' height="50" centered flex/></a><br /><br />
                        <a href='http://vib.be'><Image src='src/images/kuleuven.png' height="50" centered flex /></a><br /><br />
                        <a href='http://flycellatlas.org/'><Image src='src/images/flycellatlas.png' height="100" centered flex /></a>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}