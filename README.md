# SCope: Visualization of large-scale and high dimensional single cell data

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the data format supported by SCope is `.loom`. This file format for very large omics datasets is maintained by the Linnarsson Lab through the `loompy` Python package (https://github.com/linnarsson-lab/loompy).

## Demo

Visit [http://scope.aertslab.org](http://scope.aertslab.org) to test out SCope on several published datasets! Personal loom file files can be uploaded but will only be kept for 5 days.

## Loom File Generation

Currently there are two packages to generate extended loom files compatible with SCope.
- R: [SCopeLoomR](https://github.com/aertslab/SCopeLoomR) - Dedicated R package
- Python: [pySCENIC](https://github.com/aertslab/pySCENIC) - Single function for generation from SCENIC results

Eventually the functionality from pySCENIC will be expanded and put in its own python package.



## Requirements

- Node.js:

**Required for standalone apps, command line instances and development.**

```
# Ubuntu
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs

# Enterprise Linux and Fedora
curl -sL https://rpm.nodesource.com/setup_9.x | sudo bash -
sudo yum -y install nodejs
```
For more details and other versions please visit [https://github.com/nodesource/distributions](https://github.com/nodesource/distributions)

- Python 3 (Developed and tested with 3.6.5):

**Required for commands line instances and development.**

We recommend using miniconda to install SCope and its dependencies in a clean environment.

Download miniconda3 from https://conda.io/miniconda.html or use the command line:
```
wget --content-disposition http://bit.ly/miniconda3
```

Install Minconda (Python 3):
```
bash Miniconda3-latest-[...].sh
```

## Run SCope

### Standalone apps

Standalone apps for **macOS** and **Linux** can be downloaded from [the releases page.](https://github.com/aertslab/SCope/releases).

A **Windows** app is under development, but currently has no ETA.

### Development
Requirements should be fulfilled (see `Requirements` section).

#### Install

Create miniconda (python) virtual environment:
```
conda create -n scope python=3.6.2
source activate scope # or conda activate scope if higher version of conda
```

Install SCope:
```
npm install
```

#### Run

- One Command Run:
```
npm run scope
```

- Debug Run:
```
# Start SCope Server
scope-server

# Start SCope Client
npm run dev
```

#### 1. Packaging SCope Data Server

Requirements should be fullfilled and a `scope` python virtual should be loaded (see `Development Mode` section).

Install the SCope Server as Python package:
```
cd opt
python setup.py develop
```

Install PyInstaller:
```
cd scopeserver/dataserver
pip install pyinstaller
```

Package the SCope Data Server:
```
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
```
sudo npm install electron-packager -g
```

Finally, bundle the SCope app:
- Linux (x64)
```
npm run package-linux-x64
tar -zcvf scope-linux-x64.tar.gz scope-linux-x64
```

- macOS (x64)
```
npm run package-macOS-x64
```

Run the binary:
- Linux
```
./release/scope-linux-x64/scope
```

- macOS

Run the .app file generated

#### 3. Creating Single Executable File

##### Debian package
For more details, follow https://www.christianengvall.se/electron-installer-debian-package/
```
npm run create-debian-installer
```

##### dmg for macOS
```
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

## Deploy a Cloud-based Instance

### Amazon Web Services

#### Public AMI

Coming soon.

#### Source

To create a SCope AWS instance from scratch please read the tutorial [aws-deployment-source](https://github.com/aertslab/SCope/tree/master/tutorials/aws-deployment-source).

## Architecture

SCope architecture can be visualized below:

![SCope architecture](/images/SCope_architecture.png)
