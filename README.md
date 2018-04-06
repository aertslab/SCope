# SCope: Visualization of large-scale and high dimensional single cell data

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the format of the datasets supported by SCope is .loom. 

## Requirements

- Miniconda: 
```
wget http://bit.ly/miniconda3
bash miniconda3
```

- Node.js & npm: 
```
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs
```
For more details and other versions please visit https://github.com/nodesource/distributions

## Development Mode
Requirements should be fullfilled (see `Requirements` section).

### Install

Create miniconda (python) virtual environment:
```
conda create -n scope python=3.6.2
conda activate scope
```

Install SCope:
```
npm install
```

### Run 

- SCope Server
```
scope-server
```

- SCope Client
```
npm run dev
```

## Production Mode

### 1) Packaging SCope Data Server

Requirements should be fullfilled and a `scope` python virtual should be loaded (see `Development Mode` section).

Install the SCope Server as Python package:
```
cd opt
python setup.py develop
```

Package the SCope Data Server:
```
cd scopeserver/dataserver
pip install pyinstaller
pyinstaller --onedir --hidden-import=scipy._lib.messagestream --hidden-import=pandas._libs.tslibs.timedeltas  --hidden-import=cytoolz.utils --hidden-import=cytoolz._signatures __init__.py
```

### 2) Packaging SCope

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

### 3) Creating Single Executable File

#### Debian package
For more details, follow https://www.christianengvall.se/electron-installer-debian-package/ 
```
npm run create-debian-installer
```

All the uploaded data from SCope will be put ~/.scope/data

# Architecture

SCope architecture can be visualized below:

![GitHub Logo](/images/SCope_architecture.png)