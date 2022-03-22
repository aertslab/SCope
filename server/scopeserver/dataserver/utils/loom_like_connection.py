import loompy
from h5py import File

# This is a hack!
# A normal loompy.LoomConnection needs a file on disk.
# Since we load the loom file as a binary blob from the database, we cannot provide this and therefor loompy will not properly work.
# This custom class just overwrites the constuctor of loompy.LoomConnection to make it work with a h5py.File in memory
# Some checks/validations have been removed and there are most likely some methods from loompy.LoomConnection that will not work at all since there is no file on the FS.


class LoomLikeConnection(loompy.LoomConnection):
    def __init__(self, file: File) -> None:

        self.filename = "i_am_in_memory"

        self._file = file
        self._closed = False
        if "matrix" in self._file:
            self.shape = self._file["/matrix"].shape  #: Shape of the dataset (n_rows, n_cols)
        else:
            self.shape = (0, 0)
        self.layers = loompy.LayerManager(self)
        self.view = loompy.ViewManager(
            self
        )  #: Create a view of the file by slicing this attribute, like ``ds.view[:100, :100]``
        self.ra = loompy.AttributeManager(self, axis=0)  #: Row attributes, dict-like with np.ndarray values
        self.ca = loompy.AttributeManager(self, axis=1)  #: Column attributes, dict-like with np.ndarray values
        self.attrs = loompy.GlobalAttributeManager(self._file)  #: Global attributes
        self.row_graphs = loompy.GraphManager(
            self, axis=0
        )  #: Row graphs, dict-like with values that are :class:`scipy.sparse.coo_matrix` objects
        self.col_graphs = loompy.GraphManager(
            self, axis=1
        )  #: Column graphs, dict-like with values that are :class:`scipy.sparse.coo_matrix` objects

        # Compatibility
        self.layer = self.layers
        self.row_attrs = self.ra
        self.col_attrs = self.ca
