import React, { Component } from "react";
import { Grid, Header } from "semantic-ui-react";

// Embedded youtube videos need the following parameters 'frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen'
// Case is important here otherwise React will remove the options
const VIDEO_WIDTH = 630;
const VIDEO_HEIGHT = 355;

export default class Tutorial extends Component {
  render() {
    return (
      <Grid>
        <Grid.Row>
          <Grid.Column>
            <Header as="h1">SCope tutorial</Header>
            These tutorials will be updated as and when possible and needed.<br />
            This tutorial is based on the following .loom file:{" "}
            <a href="https://placeholder.com/" target="_blank">
              Aerts_56k.loom
            </a>
            <br />
            The following video shows the basics on doing the following: Selecting a dataset, selecting a set of t-SNE coordinates and plotting the expression of three genes.<br />
            <iframe
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              src="https://www.youtube.com/embed/w3dr6zfmjVk?rel=0"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            <br />
            First, expand the tree structure of loom files in the left sidebar under the <b>DATASETS</b> heading by clicking the down arrows next to <b>Drosophila</b> and then{" "}
            <b>Brain</b>. Next select the <b>Aerts_56k.loom</b>
            <br />
            loom file.<br />
            Once the file has loaded, if there are options in the loom file, you can change the coordinates (typically t-SNE) also from the left sidebar, under the <b>
              SETTINGS
            </b>{" "}
            heading. If you do not see a<br />
            <b>Coordinates</b> dropdown menu, only the loaded coordinates are avialable.<br />
            Finally you can use the three (<font color="red">Red</font>, <font color="green">Green</font> and <font color="blue">Blue</font>) search bars above the displayed points
            to <b>search for genes</b> that you would like to visualise. If a cell expresses several of the selected genes.<br /> colors will blend to indicate this (i.e. A cell
            with equal levels of the genes selected by the <font color="red">Red</font> and <font color="green">Green</font> search boxes will appear{" "}
            <font color="olive">Yellow</font>)
            <br /> <br />
            The visualisation of expression levels can be changed in several ways. First, as demostrated below, the sliders on the left of the viewer can be used to change the
            upper limit of the colour <br /> displayed. Reducing the slider will show lower expression levels as brighter color and vice-versa. <br />
            <iframe
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              src="https://www.youtube.com/embed/S_zKyI_-AnY?rel=0"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            <br />
            Furthermore, in the <b>SETTINGS</b>, under the <b>Gene Expression</b> header, you can toggle CPM normalization and Log2 transformations of gene expression values.
            <br />
            <br />
            <iframe
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              src="https://www.youtube.com/embed/tHUNMo3Bsi0?rel=0"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            <br />
            Once displayed, you can use the lasso tool to select a set of cells. This set is then highlighted and is stored in the right sidebar (this can be seen easier by
            minimizing the left sidebar with the <br /> button at the top right of the page). By clicking the magnifying glass next to a cell selection, you bring up the cell
            details. Currently shown is the gene expression for the three selected genes<br />and metadata such as cluster names, age etc. which can be displayed by selecting
            options from the dropdown boxes in the title bar.
          </Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}
