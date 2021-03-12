import os
import time
import uuid
import logging
import shutil
from pathlib import Path
from typing import Union

from scopeserver import SCopeServer
from scopeserver.dataserver.utils import loom_file_handler as lfh
from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils import constant

from .model import Error
from .model import GetUUID, GetRemainingUUIDTime, GetDatasets, Dataset

logger = logging.getLogger(__name__)


class SCopeAPI:
    def __init__(self, server: SCopeServer):
        self.__server = server

    def remove_all_expired_sessions(self):
        current_active_uuids = set(list(self.__server.data_handler.get_current_UUIDs().keys()))
        for uid in current_active_uuids:
            time_remaining = int(
                dfh._UUID_TIMEOUT - (time.time() - self.__server.data_handler.get_current_UUIDs()[uid][0])
            )
            if time_remaining < 0:
                logger.info("Removing folders of expired UUID: {0}".format(uid))
                del self.__server.data_handler.get_current_UUIDs()[uid]
                for i in ["Loom", "GeneSet", "LoomAUCellRankings"]:
                    if os.path.exists(os.path.join(self.__server.data_handler.get_data_dirs()[i]["path"], uid)):
                        shutil.rmtree(os.path.join(self.__server.data_handler.get_data_dirs()[i]["path"], uid))

    def get_remaining_uuid_time(
        self, session_uuid: str, ip: str, mouse_events: int
    ) -> Union[GetRemainingUUIDTime, Error]:
        self.remove_all_expired_sessions()

        __session_uuid = session_uuid
        if __session_uuid in self.__server.data_handler.get_current_UUIDs().keys():
            logger.info(f"IP {ip} connected to SCope. Using UUID {__session_uuid} from frontend.")
            start_time = self.__server.data_handler.get_current_UUIDs()[__session_uuid][0]
            time_remaining = int(dfh._UUID_TIMEOUT - (time.time() - start_time))
            self.__server.data_handler.get_uuid_log().write(
                "{0} :: {1} :: Old UUID ({2}) connected :: Time Remaining - {3}.\n".format(
                    time.strftime("%Y-%m-%d__%H-%M-%S", time.localtime()), ip, __session_uuid, time_remaining
                )
            )
            self.__server.data_handler.get_uuid_log().flush()
        else:
            logger.info(f"IP {ip} connected to SCope. Using UUID {__session_uuid} from frontend.")
            try:
                uuid.UUID(__session_uuid)
            except (KeyError, AttributeError):
                old_uid = __session_uuid
                __session_uuid = str(uuid.uuid4())
                logger.error(f"UUID {old_uid} is malformed. Passing new UUID {__session_uuid}")
            self.__server.data_handler.get_uuid_log().write(
                "{0} :: {1} :: New UUID ({2}) assigned.\n".format(
                    time.strftime("%Y-%m-%d__%H-%M-%S", time.localtime()), ip, __session_uuid
                )
            )
            self.__server.data_handler.get_uuid_log().flush()
            self.__server.data_handler.get_current_UUIDs()[__session_uuid] = [time.time(), "rw"]
            time_remaining = int(dfh._UUID_TIMEOUT)

        self.__server.data_handler.active_session_check()
        if mouse_events >= constant.MOUSE_EVENTS_THRESHOLD:
            self.__server.data_handler.reset_active_session_timeout(__session_uuid)

        sessions_limit_reached = False

        if (
            len(self.__server.data_handler.get_active_sessions().keys()) >= constant.ACTIVE_SESSIONS_LIMIT
            and __session_uuid not in self.__server.data_handler.get_permanent_UUIDs()
            and __session_uuid not in self.__server.data_handler.get_active_sessions().keys()
        ):
            sessions_limit_reached = True
            logger.warning(
                f"Maximum number of concurrent active sessions ({constant.ACTIVE_SESSIONS_LIMIT}) reached. IP {ip} will not be able to access SCope."
            )

        if __session_uuid not in self.__server.data_handler.get_active_sessions().keys() and not sessions_limit_reached:
            self.__server.data_handler.reset_active_session_timeout(__session_uuid)

        session_mode = self.__server.data_handler.get_current_UUIDs()[__session_uuid][1]
        return {
            "UUID": __session_uuid,
            "timeRemaining": time_remaining,
            "sessionsLimitReached": sessions_limit_reached,
            "sessionMode": session_mode,
        }

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
                            "loomFilePath": f,
                            "loomDisplayName": os.path.splitext(os.path.basename(f))[0],
                            "loomSize": loom.get_file_size(),
                            "cellMetaData": loom.get_filtered_metadata(
                                keys=["annotations", "clusterings", "embeddings"],
                                secret=self.__server.config["dataHashSecret"],
                            ),
                            "fileMetaData": loom.get_file_metadata(),
                            "loomHierarchy": loom.get_hierarchy(),
                        }
                    )
            except ValueError:
                pass

        self.__server.data_handler.update_UUID_db()

        return {"datasets": datasets, "update": update}
