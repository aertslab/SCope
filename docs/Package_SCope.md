# Package SCope

>THIS DOCUMENTATION IS DEPRECATED

## 1. Packaging SCope Data Server

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

## 2. Packaging SCope

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

## 3. Creating Single Executable File

##### Debian package
For more details, follow https://www.christianengvall.se/electron-installer-debian-package/

```bash
npm run create-debian-installer
```

### dmg for macOS

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