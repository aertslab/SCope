#!/bin/sh

# Compile GRPC protocol buffers definitions
mkdir -p scopeserver/grpc/
python -m grpc.tools.protoc --python_out="." --mypy_out="." --grpc_python_out="." --proto_path="../shared/protobuf/" scope-grpc.proto
