[![CodeFactor](https://www.codefactor.io/repository/github/aertslab/scope/badge)](https://www.codefactor.io/repository/github/aertslab/scope)

# SCope v1.8.2: Visualization of large-scale and high dimensional single cell data

<img src="images/SCope_Logo.png" width="640">

SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
Currently the data format supported by SCope is `.loom`. This file format for very large omics datasets is maintained by the Linnarsson Lab through the `loompy` Python package (https://github.com/linnarsson-lab/loompy).

View the [change log here](CHANGELOG.md).

## Demo

Visit [http://scope.aertslab.org](http://scope.aertslab.org) to test out SCope on several published datasets! Personal loom file files can be uploaded but will only be kept for 5 days.

## Loom File Generation

Currently there are two packages to generate extended loom files compatible with SCope.

-   R: [SCopeLoomR](https://github.com/aertslab/SCopeLoomR) - Dedicated R package
-   Python: [pySCENIC](https://github.com/aertslab/pySCENIC) - Single function for generation from SCENIC results

Eventually the functionality from pySCENIC will be expanded and put in its own python package.

## Run SCope

### Standalone App

Standalone apps for **macOS** and **Linux** can be downloaded from [the releases page.](https://github.com/aertslab/SCope/releases).

:exclamation: SCope standalone app requires Node.js (> v9). To install it, go to https://nodejs.org/en/download/.

A **Windows** app is under development, but currently has no ETA.

### Command Line

You will need access to at least Python 3.7 do run this.

1. Clone the GitHub repository and install,

```bash
# Define where you want to clone the SCope repository.
LOCAL_SCOPE_REPO="${HOME}/repos/SCope"
# Clone SCope git repository.
git clone https://github.com/aertslab/SCope "${LOCAL_SCOPE_REPO}"
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
# Install SCope.
npm install
```

2. Run,

```bash
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
SCOPE_CONFIG=config.json npm run scope
```

## Deploy a Cloud-based Instance

### Amazon Web Services

#### Public AMI

No ETA.

#### Source

To create a SCope AWS instance from scratch please read the tutorial [aws-deployment-source](https://github.com/aertslab/SCope/tree/master/tutorials/aws-deployment-source).

## Features

### Enabling ORCID Functionality

To enable colaborative annotations and login via ORCID ID, API credentials (`orcidAPIClientID`, `orcidAPIClientSecret` and `orcidAPIRedirectURI`) must be added to the config file provided.
These can be generated at the [orcid developer tools page](https://orcid.org/developer-tools).

The `dataHashSecret` entry in the config file should be filled in with a randomly generated string for example from the python [secrets package](https://docs.python.org/3/library/secrets.html).
This string will be used to salt all annotation data, allowing validation of data generated on the instance of SCope. Any changes in this string will invalidate all pre-existing annotations.

## Development

1. Clone the GitHub repository and install,

```bash
# Define where you want to clone the SCope repository.
LOCAL_SCOPE_REPO="${HOME}/repos/SCope"
# Clone SCope git repository.
git clone https://github.com/aertslab/SCope "${LOCAL_SCOPE_REPO}"
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"
# Install SCope.
npm install
```

2. Run,

```bash
# Go to your local cloned SCope repository.
cd "${LOCAL_SCOPE_REPO}"

# Start SCope Server (terminal 1).
cd opt
poetry run hypercorn main:scope_api --reload

# Start SCope Client (terminal 2).
cd ..
npm run dev
```

### Configuration file (`config.json`)

Keys:

-   `data`: This is a directory containing data files (e.g. the `motd.txt` message of the day).
    Can be an absolute path or a relative path from where you start SCope. By default it is
    `./data/`.


### Deploying SCope with Docker

`docker-compose.yml` is configured to spin up 2 containers: One to run the SCope backend and another to run an Apache
reverse proxy server.

The SCope application will be available on port `80` by default. You can specify a port by using env variable: `SCOPE_PORT`
before running the docker-compose command. Apache will proxy requests through to the appropriate port inside the container.

The `docker-compose.yml` will serve the assets from inside the scope container, and the `docker-compose.host.yml` will serve them from the host.
This supports as many use cases as possible, because you can either build the assets on the host yourself using whatever configuration you need,
or serve them from the container if your environment doesn't allow for that (e.g. you don't have npm installed on the host).

Before running the compose build, you can specify a SCOPE_PORT with: `docker-compose build --build-arg SCOPE_PORT=8080`

The scope webpack assets will have to be built with the config: `"reverseProxyOn": true`.
You can use environment variable: `SCOPE_CONFIG=path to your config` to specify a config file instead of changing the main one.

You can configure where the dockerised SCope data directories should be located
on the host machine by using the env var `SCOPE_DATA_DIR` before launching the docker-compose. 
The default location is `./scope_data` which will be created if you do not specify one.

**Note**: in this config, you do not need to specify the port in `publicHostAddress`. The env var `SCOPE_PORT` gets appended for you.

If deploying the container on a specific port with another external apache reverse-proxy server, 
you may have to add a config to the external apache site config to allow http and websocket reverse-proxying.
Here is an example:

```
    ProxyPass / http://0.0.0.0:8080/
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://0.0.0.0:8080/$1" [P,L]
```

##### Example serve from container

1. Copy `config.json` to a new file and modify with `"reverseProxyOn": true,` and `publicHostAddress` set to your domain
1. `docker-compose build --build-arg SCOPE_PORT=8080`
1. ```SCOPE_DATA_DIR=$HOME/scope_data SCOPE_PORT=8080 docker-compose up -d```

##### OR Serve from host
1. ```npm run build```
1. ```SCOPE_DATA_DIR=$HOME/scope_data SCOPE_PORT=8080 docker-compose -f docker-compose.host.yml up -d```

You should be able to visit `http://localhost:8080` and see the app!

