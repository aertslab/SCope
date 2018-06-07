# SCope: Visualization of large-scale and high dimensional single cell data

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the format of the datasets supported by SCope is .loom. 

## Requirements

- Miniconda:

Download miniconda3 from https://conda.io/miniconda.html or use the command line:
```
wget --content-disposition http://bit.ly/miniconda3
```

Install Minconda (Python 3):
```
bash Miniconda3-latest-[...].sh
```

- Node.js & npm: 
```
# Ubuntu
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs

# Enterprise Linux and Fedora
curl -sL https://rpm.nodesource.com/setup_9.x | sudo bash -
sudo yum -y install nodejs
```
For more details and other versions please visit https://github.com/nodesource/distributions

## Run a Local Instance

### Development Mode
Requirements should be fullfilled (see `Requirements` section).

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

### Production Mode

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
Run the binary:
```
./release/scope-linux-x64/scope
```

#### 3. Creating Single Executable File

##### Debian package
For more details, follow https://www.christianengvall.se/electron-installer-debian-package/ 
```
npm run create-debian-installer
```

All the uploaded data from SCope will be put ~/.scope/data

## Deploy a Cloud-based Instance

### Amazon Web Services

#### Public AMI

Coming soon.

#### Source

To create a SCope AWS instance from scratch can read the tutorial [aws-deployment-source](https://github.com/aertslab/SCope/tutorials/aws-deployment-source/).

## Architecture

SCope architecture can be visualized below:

![GitHub Logo](/images/SCope_architecture.png)
