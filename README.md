# SCope: Visualization of large-scale and high dimensional single cell data

## Launch

### Server

#### Data Server (DS)

```
cd scope-server/scopeserver/modules/xserver
npm install
```

```
python scope-server/scopeserver/__init__.py
```

### Client

- Install
```
cd scope-client
npm install
```

- Run development version
```
cd scope-client
npm run dev
```

NOTE: Run from SCope root directory otherwise if run from within Client directory `TypeError: Cannot read property 'ns' of null` arises!
