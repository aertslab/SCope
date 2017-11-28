from concurrent import futures
import time

import grpc
import SCope_pb2
import SCope_pb2_grpc

import loompy as lp
from loompy import LoomConnection
import hashlib
import os

_ONE_DAY_IN_SECONDS = 60 * 60 * 24


class SCopeSearch(SCope_pb2_grpc.SCopeSearchServicer):

    def __init__(self):
        self.active_loom_connections = {}

    @staticmethod
    def get_partial_md5_hash(file_path, last_n_kb):
        with open(file_path, 'rb') as f:
            f.seek(- last_n_kb * 1024, 2)
            return hashlib.md5(f.read()).hexdigest()

    def add_loom_connection(self, partial_md5_hash, loom):
        self.active_loom_connections[partial_md5_hash] = loom

    def load_loom_file(self, loom_file_path):
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        # To check if the given file path is given specified url!
        partial_md5_hash = SCopeSearch.get_partial_md5_hash(
            loom_file_path, 10000)
        if partial_md5_hash in self.active_loom_connections:
            return self.active_loom_connections[partial_md5_hash]
        else:
            loom = lp.connect(loom_file_path)
            self.add_loom_connection(partial_md5_hash, loom)
            return loom

    def Add(self, request, context):
        return SCope_pb2.AddReply(n1=request.n1 + request.n2)

    def Substract(self, request, context):
        return SCope_pb2.SubstractReply(n1=request.n1 - request.n2)

    def Multiply(self, request, context):
        return SCope_pb2.MultiplyReply(n1=request.n1 * request.n2)

    def Divide(self, request, context):
        return SCope_pb2.DivideReply(f1=request.n1 / request.n2)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    SCope_pb2_grpc.add_SCopeSearchServicer_to_server(SCopeSearch(), server)
    server.add_insecure_port('[::]:50050')
    server.start()
    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except KeyboardInterrupt:
        server.stop(0)


if __name__ == '__main__':
    serve()
