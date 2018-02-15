# SCope: Visualization of large-scale and high dimensional single cell data

## Server

### Data Server (DS)

- Install
```
cd scope-server/scopeserver/modules/xserver
npm install
```

```
cd scope-server
python setup.py develop
```

- Run (development version)
```
scope-server
```

### Client

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

NOTE: Run from SCope root directory otherwise if run from within Client directory `TypeError: Cannot read property 'ns' of null` arises!
