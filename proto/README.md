# Generate Python client and server code and copy it to the directories
```
python -m grpc.tools.protoc  --python_out=../scope-server --grpc_python_out=../scope-server --proto_path=. SCope.proto
```
