# Generate Python client and server code and copy it to the directories
```
python -m grpc.tools.protoc  --python_out=../../../scope-server/slaves/gserver --grpc_python_out=../../../scope-server/slaves/gserver --proto_path=. s.proto
```
