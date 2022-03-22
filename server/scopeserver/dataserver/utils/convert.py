from io import BytesIO
from fastapi import UploadFile
from h5py import File
from loompy import LoomLayer
from scipy import sparse
from scopeserver.dataserver.utils.loom_like_connection import LoomLikeConnection
from scopeserver.models import BinaryData


def matrix_from_binary_loom(data: BinaryData) -> sparse.coo_matrix:
    loom_connection = LoomLikeConnection(File(BytesIO(data.data), mode="r"))
    layer = LoomLayer("", loom_connection)

    return layer.sparse()
