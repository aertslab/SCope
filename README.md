# SCope: Visualization of large-scale and high dimensional single cell RNA-seq data

## Launch

### Server

#### Data Server (DS)
```
python scope-server/scopeserver/__init__.py
```

### Client

- Install
```
npm install
```

- Run development version
```
cd scope-client
npm run dev
```

NOTE: Run from SCope root directory otherwise if run from within Client directory `TypeError: Cannot read property 'ns' of null` arises!
