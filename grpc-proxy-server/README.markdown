GRPC-Bus WebSocket Proxy Server

This Node.js server acts as a proxy, connecting GRPC clients running in a browser context to standard GRPC service(s) via a WebSocket.

Usage

```
node server.js
```

How it Works

The browser client loads the Protobuf definition (either as a `.proto`
file or compiled as a `.proto.json`), and passes it to the server via
the initial message after creating the WebSocket connection.

Deployment

There is a [Docker image built](https://hub.docker.com/r/gabrielgrant/grpc-bus-websocket-proxy/) that can be run with:

```
docker run gabrielgrant/grpc-bus-websocket-proxy
```

It can also be deployed on a Kubernetes cluster using the included manifest:

```
kubectl create -f kubernetes-manifest.yaml
```

If redeploying, delete the earlier deployment first:

```
kubectl delete -f kubernetes-manifest.yaml && kubectl create -f kubernetes-manifest.yaml
```

TODO

- Upgrade to Protobuf JS v6
- Serve static content
- Allow server to load .proto file directly
- Push .proto file from server to client
- Validate service map against proto file
- Beter Error Handling
- Support bundled/synchronous loading of JSON-formatted protoDefs
- Specify allowed connections as CLI arg: --allow [service_name:]server:port
- Specify port as CLI arg:  --port 8080

Publishing a new version:

```
docker build -t gabrielgrant/grpc-bus-websocket-proxy:{{VERSION}} .
docker push gabrielgrant/grpc-bus-websocket-proxy
```

