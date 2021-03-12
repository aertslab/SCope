import os
from pathlib import Path
from typing import Union
from scopeserver import SCopeServer
from .model import Error
from .model import GetDatasets, Dataset


class SCopeAPI:
    def __init__(self, server: SCopeServer):
        self.__server = server

    def get_datasets(self, session_uuid: str, dataset_file_name: str = None) -> Union[GetDatasets, Error]:
        datasets = []
        update = False
        user_data_dir = self.__server.data_handler.get_data_dir_path_by_file_type(
            file_type="Loom", session_uuid=session_uuid
        )

        if not os.path.isdir(s=user_data_dir):
            for i in ["Loom", "GeneSet", "LoomAUCellRankings"]:
                os.mkdir(os.path.join(self.__server.data_handler.get_data_dirs()[i]["path"], session_uuid))

        # TODO: Does this really need to happen here ?
        self.__server.update_global_data()

        datasets_to_process = sorted(self.__server.dataset_handler.get_global_looms()) + sorted(
            [os.path.join(session_uuid, x) for x in os.listdir(user_data_dir)]
        )

        if dataset_file_name:
            if dataset_file_name in datasets_to_process:
                datasets_to_process = [dataset_file_name]
                update = True
            else:
                msg = "User requested a loom file wich is not available"
                SCopeServer.logger.error(msg)
                return {"error": {"code": 404, "message": msg}, "datasets": [], "update": False}

        for f in datasets_to_process:
            try:
                if f.endswith(".loom"):
                    loom = self.__server.dataset_handler.get_loom(loom_file_path=Path(f))
                    if loom is None:
                        continue

                    datasets.append(
                        {
                            "loom_file_path": f,
                            "loom_display_name": os.path.splitext(os.path.basename(f))[0],
                            "loom_size": loom.get_file_size(),
                            "cell_metadata": loom.get_filtered_metadata(
                                keys=["annotations", "clusterings", "embeddings"]
                            ),
                            "file_metadata": loom.get_file_metadata(),
                            "loom_hierarchy": loom.get_hierarchy(),
                        }
                    )
            except ValueError:
                pass

        self.__server.data_handler.update_UUID_db()

        return {"datasets": datasets, "update": update}
