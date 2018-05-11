# Generate Python client and server code and copy it to the directories

Run the command line below at the root of the project to compile the .proto interface file:
```
python3 -m grpc.tools.protoc  --python_out=opt/scopeserver/dataserver/modules/gserver/ --grpc_python_out=opt/scopeserver/dataserver/modules/gserver/ --proto_path=src/proto/ s.proto

```
Discard changes to `opt/scopeserver/dataserver/modules/gserver/s_pb2_grpc.py` after running the above command.
