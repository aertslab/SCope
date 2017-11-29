from concurrent import futures
import time

import grpc
import SCope_pb2
import SCope_pb2_grpc

import loompy as lp
from loompy import LoomConnection
import hashlib
import os
import math
import numpy as np
import time

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

    def load_loom_file(self, partial_md5_hash, loom_file_path):
        loom = lp.connect(loom_file_path)
        self.add_loom_connection(partial_md5_hash, loom)
        return loom

    def get_loom_connection(self, loom_file_path):
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        # To check if the given file path is given specified url!
        partial_md5_hash = SCopeSearch.get_partial_md5_hash(
            loom_file_path, 10000)
        if partial_md5_hash in self.active_loom_connections:
            return self.active_loom_connections[partial_md5_hash]
        else:
            print("Debug: loading the loom file from " + loom_file_path + "...")
            return self.load_loom_file(partial_md5_hash, loom_file_path)

    def get_gene_expression(self, loom_file_path, gene_symbol, log_transform=True):
        loom = self.get_loom_connection(loom_file_path)
        print("Debug: getting expression of " + gene_symbol + "...")
        gene_expr = loom[loom.Gene == gene_symbol, :]
        if log_transform:
            print("Debug: log-transforming gene expression...")
            return np.log2(gene_expr + 1)[0]
        return gene_expr

    def Query(self, request, context):
        start_time = time.time()
        if request.feature == "gene":
            gene_expr = self.get_gene_expression(
                loom_file_path=request.filepath, gene_symbol=request.entry, log_transform=request.logtransform)
            reply = SCope_pb2.QueryReply(v=gene_expr)
        else:
            reply = []
        print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        return reply


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
