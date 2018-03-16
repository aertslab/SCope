# SCope: Visualization of large-scale and high dimensional single cell data

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the format of the datasets supported by SCope is .loom. 

## Development

### SCope Server

- Install
```
cd scope-server
python setup.py develop
```

- Run (development version)
```
scope-server
```

### SCope Client

- Install
```
cd scope-client
npm install
```

- Run (development version)
```
cd scope-client
npm run dev
```

## Production

### Packaging SCope Server

Install python 3.6:
```
sudo add-apt-repository ppa:jonathonf/python-3.6
sudo apt-get update
sudo apt-get install python3.6
sudo apt-get install libpython3.6-dev
```

Create python virtual environment:
```
cd opt/scopeserver
virtualenv -p python3.6 pyvenv
source pyvenv/bin/activate
```

Install the SCope Server as Python package:
```
cd ..
python3.6 setup.py develop
```

Package the SCope Server:
```
pip3.6 install pyinstaller
pyinstaller --onedir --hidden-import=scipy._lib.messagestream --hidden-import=pandas._libs.tslibs.timedeltas __init__.py
```

### Packaging SCope

First install electron-packager node module:
```
sudo npm install electron-packager -g
```

Finally, bundle the SCope app:
- Linux (x64)
```
npm run package-linux-x64
sudo tar -zcvf scope-linux-x64.tar.gz scope-linux-x64
```