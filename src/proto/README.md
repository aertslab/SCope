# Generate Python client and server code and copy it to the directories

Run the command line below at the root of the project:
```
python -m grpc.tools.protoc  --python_out=scope-server/scopeserver/modules/gserver/ --grpc_python_out=scope-server/scopeserver/modules/gserver/ --proto_path=scope-client/src/proto/ s.proto
```
