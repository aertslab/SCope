[![CodeFactor](https://www.codefactor.io/repository/github/aertslab/scope/badge)](https://www.codefactor.io/repository/github/aertslab/scope)

# SCope v1.8.1: Visualization of large-scale and high dimensional single cell data

<img src="images/SCope_Logo.png" width="640">

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the data format supported by SCope is `.loom`. This file format for very large omics datasets is maintained by the Linnarsson Lab through the `loompy` Python package (https://github.com/linnarsson-lab/loompy).

View the [change log here](CHANGELOG.md).

## Demo

Visit [http://scope.aertslab.org](http://scope.aertslab.org) to test out SCope on several published datasets! Personal loom file files can be uploaded but will only be kept for 5 days.

## Loom File Generation

Currently there are two packages to generate extended loom files compatible with SCope.

-   R: [SCopeLoomR](https://github.com/aertslab/SCopeLoomR) - Dedicated R package
-   Python: [pySCENIC](https://github.com/aertslab/pySCENIC) - Single function for generation from SCENIC results

Eventually the functionality from pySCENIC will be expanded and put in its own python package.

## Run SCope

### Standalone App

Standalone apps for **macOS** and **Linux** can be downloaded from [the releases page.](https://github.com/aertslab/SCope/releases).

:exclamation: SCope standalone app requires Node.js (> v9). To install it, go to https://nodejs.org/en/download/.

A **Windows** app is under development, but currently has no ETA.

### Command Line

You will need access to at least Python 3.7 do run this.

1. Clone the GitHub repository and install,

```bash
# Define where you want to clone the SCope repository.
LOCAL_SCOPE_REPO="${HOME}/repos/SCope"
# Clone SCope git repository.
git clone https://github.com/aertslab/SCope "${LOCAL_SCOPE_REPO}"
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
# Install SCope.
npm install
```

2. Run,

```bash
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
npm run scope
```

## Deploy a Cloud-based Instance

### Amazon Web Services

#### Public AMI

No ETA.

#### Source

To create a SCope AWS instance from scratch please read the tutorial [aws-deployment-source](https://github.com/aertslab/SCope/tree/master/tutorials/aws-deployment-source).

## Features

### Enabling ORCID Functionality

To enable colaborative annotations and login via ORCID ID, API credentials (`orcidAPIClientID`, `orcidAPIClientSecret` and `orcidAPIRedirectURI`) must be added to the config file provided.
These can be generated at the [orcid developer tools page](https://orcid.org/developer-tools).

The `dataHashSecret` entry in the config file should be filled in with a randomly generated string for example from the python [secrets package](https://docs.python.org/3/library/secrets.html).
This string will be used to salt all annotation data, allowing validation of data generated on the instance of SCope. Any changes in this string will invalidate all pre-existing annotations.

## Development

1. Clone the GitHub repository and install,

```bash
# Define where you want to clone the SCope repository.
LOCAL_SCOPE_REPO="${HOME}/repos/SCope"
# Clone SCope git repository.
git clone https://github.com/aertslab/SCope "${LOCAL_SCOPE_REPO}"
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
# Install SCope.
npm install
```

2. Run,

```bash
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"

# Start SCope Server (terminal 1).
cd opt
poetry shell
scope-server

# Start SCope Client (terminal 2).
cd ..
npm run dev
```
