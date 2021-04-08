import logging

# from scopeserver.orcid import ORCID
from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils import loom_file_handler as lfh


class SCopeServer:

    app_name = "SCope"
    app_author = "Aertslab"

    logger = logging.getLogger(__name__)

    def __init__(self, config):
        self.__config = config
        self.__data_handler = dfh.DataFileHandler()
        self.__data_handler.set_global_data()
        self.__dataset_handler = lfh.LoomFileHandler()
        self.__dataset_handler.set_global_data()
        # self.__orcid = ORCID(server=self)

    @property
    def config(self):
        return self.__config

    @property
    def data_handler(self):
        return self.__data_handler

    @property
    def dataset_handler(self):
        return self.__dataset_handler

    # @property
    # def orcid(self):
    #     return self.__orcid

    # TODO: Currently this is also defined in the legacy server! Out of sync issues => how best to deal with this ? Move instantation to new server ?
    def update_global_data(self) -> None:
        self.__data_handler.set_global_data()
        self.__dataset_handler.set_global_data()
