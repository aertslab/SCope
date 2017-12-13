# SCope Server/Client

## G-Server

The GServer was built using the gRPC python implementation available from pip. The python implementation was chosen because a nice file format (.loom) has been developed to store single-cell dataset in a efficient way.

### Install gRPC (Python implementation)

From https://grpc.io/docs/quickstart/python.html:
```
python -m pip install --upgrade pip
python -m pip install grpcio
python -m pip install grpcio-tools
```

### Define the gRPC service
The gRPC service is defined by means of the protobuf file (.proto).

### Generate the gRPC code

The gRPC code is mode of 2 files: `*_pb2_grpc.py` and `*_pb2.py`. Those are generated using the following code:
```
python -m grpc.tools.protoc  --python_out=. --grpc_python_out=. --proto_path=. .proto
```

## G-Client

Calling the G-Server using the gRPC Node.js implementation is easy however it isn't that trivial to call the G-Server from the Web. It's not possible to connect to gRPC from the using the following code:
```
var PROTO_PATH = 'proto/SCope.proto';
var grpc = require('grpc');
var scope_proto = grpc.load(PROTO_PATH).scope;

let params = { lfp: "FB_20170919_LD.loom"
             , f: ["gene","gene","gene"]
             , e: ["Gad1","VGlut","VAChT"]
             , lte: true };

let client = new scope_proto.SCope('localhost:50050', grpc.credentials.createInsecure());

client.getCellColorByFeatures(params, function (err, response) {
    console.log(response.v);
});
```
But actually, why do we want to be able to work from the Web? It's partially because it's very useful for development 

This is not possible it's need to access a file using the file system which is prohibited from Web perspective.

- `ZeroRPC` available at http://www.zerorpc.io/ was also tried out but faced up with the same problem
- Bundling the service (.proto) into a JS script and import it from the index.html (following https://auth0.com/blog/beating-json-performance-with-protobuf/) did also not work
- `grpclib` from https://github.com/vmagamedov/grpclib did not work neither

After GitHub conversation, to connect a Web application to gRPC server one need a reverse proxy in between because the 2 different actors does not share the same protocol. This stackoverlow post https://stackoverflow.com/questions/35065875/how-to-bring-a-grpc-defined-api-to-the-web-browser confirms this statement.

- `grpc-web-proxy` from `grpc-web` GitHub repository was tried out but was not able to connect to the G-Server
- `grpc-bus-websocket-client` from GitHub repository available at https://github.com/gabrielgrant/grpc-bus-websocket-proxy-server was finally the solution to the problem!

## X-Server

### Install Proxy Server (GRPC-Bus WebSocket Proxy Server)

```
git clone https://github.com/gabrielgrant/grpc-bus-websocket-proxy-server.git
mv grpc-bus-websocket-proxy-server/* .
npm install
```



