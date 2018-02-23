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

Once generated, `s_pb2_grpc.py` should be edited to fix module imports.

```
import s_pb2 as s__pb2
```

should be replaced with

```
from scopeserver.modules.gserver import s_pb2 as s__pb2
```

## X-Server

### Install Proxy Server (GRPC-Bus WebSocket Proxy Server)

```
git clone https://github.com/gabrielgrant/grpc-bus-websocket-proxy-server.git
mv grpc-bus-websocket-proxy-server/* .
npm install
```
