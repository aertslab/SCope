# SCope: Visualization of large-scale and high dimensional single cell data

## Server

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

- Packaging

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

Finally package the SCope Server:
```
pip3.6 install pyinstaller
pyinstaller --onedir --hidden-import=scipy._lib.messagestream --hidden-import=pandas._libs.tslibs.timedeltas __init__.py
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

### Packaging 

First install electron-packager node module:
```
sudo npm install electron-packager -g
```

- Linux (x64)
```
npm run package-linux-x64
sudo tar -zcvf scope-linux-x64.tar.gz scope-linux-x64
```