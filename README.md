[![CodeFactor](https://www.codefactor.io/repository/github/aertslab/scope/badge)](https://www.codefactor.io/repository/github/aertslab/scope)

# SCope v1.8.0: Visualization of large-scale and high dimensional single cell data
<img src="images/SCope_Logo.png" width="640">

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the data format supported by SCope is `.loom`. This file format for very large omics datasets is maintained by the Linnarsson Lab through the `loompy` Python package (https://github.com/linnarsson-lab/loompy).

View the [change log here](CHANGELOG.md).

## Demo

Visit [http://scope.aertslab.org](http://scope.aertslab.org) to test out SCope on several published datasets! Personal loom file files can be uploaded but will only be kept for 5 days.

## Loom File Generation

Currently there are two packages to generate extended loom files compatible with SCope.
- R: [SCopeLoomR](https://github.com/aertslab/SCopeLoomR) - Dedicated R package
- Python: [pySCENIC](https://github.com/aertslab/pySCENIC) - Single function for generation from SCENIC results

Eventually the functionality from pySCENIC will be expanded and put in its own python package.


## Run SCope

### Standalone apps

Standalone apps for **macOS** and **Linux** can be downloaded from [the releases page.](https://github.com/aertslab/SCope/releases).

:exclamation: SCope standalone app requires Node.js (> v9). To install it, go to https://nodejs.org/en/download/.

A **Windows** app is under development, but currently has no ETA.

### Development
Requirements should be fulfilled (see `Requirements` section).

#### Clone repository

```bash
# Define where you want to clone the SCope repository.
LOCAL_SCOPE_REPO="${HOME}/repos/SCope"

# Clone SCope git repository.
git clone https://github.com/aertslab/SCope "${LOCAL_SCOPE_REPO}"
```

### Install miniconda and create SCope environment.

We recommend using miniconda to install SCope and its dependencies in a clean environment.

Download miniconda3 from https://conda.io/miniconda.html or use the command line:

```bash
wget --content-disposition http://bit.ly/miniconda3
```

Install Minconda:

```bash
bash Miniconda3-latest-[...].sh
```

Create miniconda virtual environment with python (3.6 or higher) and nodejs (9 or higher) for SCope:

```bash
# Install python and nodejs with conda.
conda create -n scope 'python==3.6.2' 'nodejs>=9'
```

#### Install SCope

Activate miniconda virtual environment with python (3.6 or higher) and nodejs (9 or higher) and install SCope:

```bash
# Activate SCope environment.
conda activate scope

# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"

# Install SCope.
npm install
```

#### Run

- One Command Run:

```bash
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"

npm run scope
```

- Debug Run in 2 terminals:

```bash
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"

# Start SCope Server (terminal 1).
scope-server

# Start SCope Client (terminal 2).
npm run dev
```

#### 1. Packaging SCope Data Server

Activate SCope environment (see `Install miniconda and create SCope environment.` section if you do not have one yet):

```bash
# Activate SCope environment.
conda activate scope

# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
```

Install the SCope Server as Python package:

```bash
cd opt
python setup.py develop
```

Install PyInstaller:

```bash
cd scopeserver/dataserver
pip install pyinstaller
```

Package the SCope Data Server:

```bash
cd ./opt/scopeserver/dataserver
LD_LIBRARY_PATH=${CONDA_PATH}/lib pyinstaller \
	--onedir \
	--hidden-import=scipy._lib.messagestream \
	--hidden-import=pandas._libs.tslibs.timedeltas  \
	--hidden-import=cytoolz.utils \
	--hidden-import=cytoolz._signatures __init__.py \
	--hidden-import=pandas._libs.tslibs.np_datetime \
	--hidden-import=pandas._libs.tslibs.nattype \
	--hidden-import=pandas._libs.skiplist
```

`${CONDA_PATH}` is the path where Miniconda has been installed.

#### 2. Packaging SCope

First install electron-packager node module:

```bash
sudo npm install electron-packager -g
```

Finally, bundle the SCope app:
- Linux (x64)

```bash
npm run package-linux-x64
tar -zcvf scope-linux-x64.tar.gz scope-linux-x64
```

- macOS (x64)

```bash
npm run package-macOS-x64
```

Run the binary:
- Linux

```bash
./release/scope-linux-x64/scope
```

- macOS

Run the .app file generated

#### 3. Creating Single Executable File

##### Debian package
For more details, follow https://www.christianengvall.se/electron-installer-debian-package/

```bash
npm run create-debian-installer
```

##### dmg for macOS

```bash
git clone https://github.com/andreyvit/yoursway-create-dmg.git
./yoursway-create-dmg/create-dmg \
	--volname "SCope Installer" \
	--volicon "images/SCope_Icon.icns" \
	--background "images/SCope_Background.png" \
	--window-pos 200 120 \
	--window-size 800 400 \
	--icon-size 100 \
	--icon release/scope-darwin-x64/scope.app 192 344 \
	--hide-extension scope.app \
	--app-drop-link 448 344 \
	${TRAVIS_BUILD_DIR}/release/scope-macOS-x64.dmg \
	release/scope-darwin-x64/scope.app/
```

All uploaded data from SCope will be put in the following folders by default:
- Linux
`~/.local/share/scope/`

- macOS
`~/Library/Application\ Support/scope/`

## Enabling ORCID Functionality

To enable colaborative annotations and login via ORCID ID, API credentials (`orcidAPIClientID`, `orcidAPIClientSecret` and `orcidAPIRedirectURI`) must be added to the config file provided. 
These can be generated at the [orcid developer tools page](https://orcid.org/developer-tools).

The `dataHashSecret` entry in the config file should be filled in with a randomly generated string for example from the python [secrets package](https://docs.python.org/3/library/secrets.html). 
This string will be used to salt all annotation data, allowing validation of data generated on the instance of SCope. Any changes in this string will invalidate all pre-existing annotations.


## Deploy a Cloud-based Instance

### Amazon Web Services

#### Public AMI

Coming soon.

#### Source

To create a SCope AWS instance from scratch please read the tutorial [aws-deployment-source](https://github.com/aertslab/SCope/tree/master/tutorials/aws-deployment-source).

## Architecture

SCope architecture can be visualized below:

![SCope architecture](/images/SCope_architecture.png)
