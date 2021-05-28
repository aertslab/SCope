import os
import numpy as np

from scopeserver.dataserver.utils import data_file_handler as dfh

from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils import data
from scopeserver.dataserver.modules.gserver import s_pb2
import logging

logger = logging.getLogger(__name__)


class GeneSetEnrichment:
    def __init__(self, scope, method, loom, gene_set_file_path, annotation):
        """Constructor
        :type dgem: ndarray
        :param dgem: digital gene expression matrix with cells as columns and genes as rows
        :type gene_set_file_path: str
        :param gene_set_file_path: Absolute file path to the gene set
        """
        self.scope = scope
        self.method = method
        self.loom = loom
        self.gene_set_file_path = gene_set_file_path
        self.annotation = annotation
        self.AUCell_rankings_dir = dfh.DataFileHandler.get_data_dir_path_by_file_type("LoomAUCellRankings")

    class State:
        def __init__(self, step, status_code, status_message, values):
            self.step = step
            self.status_code = status_code
            self.status_message = status_message
            self.values = values

        def get_values(self):
            return self.values

        def get_status_code(self):
            return self.status_code

        def get_status_message(self):
            return self.status_message

        def get_step(self):
            return self.step

    def update_state(self, step, status_code, status_message, values):
        state = GeneSetEnrichment.State(
            step=step, status_code=status_code, status_message=status_message, values=values
        )
        logger.debug("Status: {0}".format(state.get_status_message()))
        if state.get_values() is None:
            return s_pb2.GeneSetEnrichmentReply(
                progress=s_pb2.Progress(value=state.get_step(), status=state.get_status_message()),
                isDone=False,
                cellValues=s_pb2.CellColorByFeaturesReply(color=[], vmax=[], maxVmax=[], cellIndices=[]),
            )
        else:
            vmax = np.zeros(3)
            max_vmax = np.zeros(3)
            aucs = state.get_values()
            _vmax = data.get_99_and_100_percentiles(values=aucs)
            vmax[0] = _vmax[0]
            max_vmax[0] = _vmax[1]
            vals = aucs / vmax[0]
            vals = (
                ((constant.UPPER_LIMIT_RGB - constant.LOWER_LIMIT_RGB) * (vals - min(vals))) / (1 - min(vals))
            ) + constant.LOWER_LIMIT_RGB
            hex_vec = [
                "null" if r == g == b == 0 else "{0:02x}{1:02x}{2:02x}".format(int(r), int(g), int(b))
                for r, g, b in zip(vals, np.zeros(len(aucs)), np.zeros(len(aucs)))
            ]
            cell_indices = list(range(self.loom.get_nb_cells()))
            return s_pb2.GeneSetEnrichmentReply(
                progress=s_pb2.Progress(value=state.get_step(), status=state.get_status_message()),
                isDone=True,
                cellValues=s_pb2.CellColorByFeaturesReply(
                    color=hex_vec, vmax=vmax, maxVmax=max_vmax, cellIndices=cell_indices
                ),
            )

    def get_method(self):
        return self.method

    def get_AUCell_ranking_filepath(self):
        AUCell_rankings_file_name = self.loom.get_file_path().split(".")[0] + "." + "AUCell.rankings.loom"
        return os.path.join(self.AUCell_rankings_dir, AUCell_rankings_file_name)

    def has_AUCell_rankings(self):
        return os.path.exists(self.get_AUCell_ranking_filepath())

    def run_AUCell(self):
        """"""

    def run(self):
        if self.method == "AUCell":
            self.run_AUCell()
        else:
            self.update_state(
                step=0, status_code=404, status_message="This enrichment method is not implemented!", values=None
            )
