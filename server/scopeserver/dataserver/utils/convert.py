from io import BytesIO
from h5py import File
from loompy import LoomLayer
from scipy import sparse
from scopeserver.dataserver.utils.loom_like_connection import LoomLikeConnection
from scopeserver.models import BinaryData


def matrix_from_loom(data: BinaryData) -> sparse.coo_matrix:
    if data.data_format != "loom":
        return

    loom_connection = LoomLikeConnection(File(BytesIO(data.data), mode="r"))
    layer = LoomLayer("", loom_connection)

    return layer.sparse()
