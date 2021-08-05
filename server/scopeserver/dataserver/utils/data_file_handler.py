import os
import time
from uuid import uuid4
import pickle
from typing import TextIO
import logging

from appdirs import AppDirs

from scopeserver.config import settings

LOGGER = logging.getLogger(__name__)

app_name = "SCope"
app_author = "Aertslab"

platform_dirs = AppDirs(appname=app_name, appauthor=app_author)

_ONE_DAY_IN_SECONDS = 60 * 60 * 24
_UUID_TIMEOUT = _ONE_DAY_IN_SECONDS * 5
_SESSION_TIMEOUT = 60 * 5

data_dirs = {
    "Loom": {
        "path": os.path.join(platform_dirs.user_data_dir, "my-looms"),
        "message": "No data folder detected. Making loom data folder: {0}.".format(
            str(os.path.join(platform_dirs.user_data_dir, "my-looms"))
        ),
    },
    "GeneSet": {
        "path": os.path.join(platform_dirs.user_data_dir, "my-gene-sets"),
        "message": "No gene-sets folder detected. Making gene-sets data folder in current directory: {0}.".format(
            str(os.path.join(platform_dirs.user_data_dir, "my-gene-sets"))
        ),
    },
    "LoomAUCellRankings": {
        "path": os.path.join(platform_dirs.user_data_dir, "my-aucell-rankings"),
        "message": "No AUCell rankings folder detected. Making AUCell rankings data folder in current directory: {0}.".format(
            str(os.path.join(platform_dirs.user_data_dir, "my-aucell-rankings"))
        ),
    },
    "Config": {
        "path": os.path.join(platform_dirs.user_config_dir),
        "message": "No Config folder detected. Making Config folder: {0}.".format(
            str(os.path.join(platform_dirs.user_config_dir))
        ),
    },
    "Logs": {
        "path": os.path.join(platform_dirs.user_log_dir),
        "message": "No Logs folder detected. Making Logs folder: {0}.".format(
            str(os.path.join(platform_dirs.user_log_dir))
        ),
    },
}


class DataFileHandler:

    data_dirs = data_dirs

    def __init__(self):
        self.current_UUIDs = {}
        self.dmel_mappings = {}
        self.permanent_UUIDs = set()
        self.orcid_ids = {}
        self.active_sessions = {}
        self.uuid_log = None
        self.data_dirs = data_dirs
        self.gene_sets_dir = DataFileHandler.get_data_dir_path_by_file_type(file_type="GeneSet")
        self.rankings_dir = DataFileHandler.get_data_dir_path_by_file_type(file_type="LoomAUCellRankings")
        self.config_dir = DataFileHandler.get_data_dir_path_by_file_type(file_type="Config")
        self.logs_dir = DataFileHandler.get_data_dir_path_by_file_type(file_type="Logs")
        self.create_global_dirs()
        self.create_uuid_log()
        self.load_gene_mappings()

    def get_gene_sets_dir(self) -> str:
        return self.gene_sets_dir

    def get_config_dir(self) -> str:
        return self.config_dir

    def get_gobal_sets(self) -> list:
        return self.global_sets

    def get_global_rankings(self) -> list:
        return self.global_rankings

    def set_global_data(self) -> None:
        self.global_sets = [
            x for x in os.listdir(self.gene_sets_dir) if not os.path.isdir(os.path.join(self.gene_sets_dir, x))
        ]
        self.global_rankings = [
            x for x in os.listdir(self.rankings_dir) if not os.path.isdir(os.path.join(self.rankings_dir, x))
        ]

    @staticmethod
    def get_data_dir_path_by_file_type(file_type: str, UUID: str = None) -> str:
        if file_type in ["Loom", "GeneSet", "LoomAUCellRankings"] and UUID is not None:
            globalDir = data_dirs[file_type]["path"]
            UUIDDir = os.path.join(globalDir, UUID)
            return UUIDDir
        return data_dirs[file_type]["path"]

    @staticmethod
    def get_data_dirs() -> dict:
        return data_dirs

    def create_global_dirs(self) -> None:
        for data_type in self.data_dirs.keys():
            if not os.path.isdir(data_dirs[data_type]["path"]):
                LOGGER.error(self.data_dirs[data_type]["message"])
                os.makedirs(self.data_dirs[data_type]["path"])

    # ORCID_ID  UUID1,UUID2,UUID3   NAME

    def read_ORCID_db(self) -> None:
        LOGGER.debug('Building UUID "database"')
        if os.path.isfile(os.path.join(self.config_dir, "ORCID_IDs.txt")):
            with open(os.path.join(self.config_dir, "ORCID_IDs.txt"), "r") as fh:
                for line in fh.readlines():
                    orcid_id, orcid_scope_uuids, name = line.rstrip("\n").split("\t")
                    self.orcid_ids[orcid_id] = (set([x for x in orcid_scope_uuids.split(",")]), name)

    def confirm_orcid_uuid(self, user_id, user_uuid) -> bool:
        self.read_ORCID_db()
        LOGGER.debug(f"Confirming User: {user_id}, uuid: {user_id}")
        LOGGER.debug(f"Current DB {self.orcid_ids}")

        if user_id in self.orcid_ids.keys():
            if user_uuid in self.orcid_ids[user_id][0]:
                return True
        LOGGER.error(f"AUTHENTICATION FAILURE: user: {user_id}, uuid: {user_uuid}")
        return False

    def add_ORCIDiD(self, orcid_scope_uuid: str, name: str, orcid_id: str) -> None:
        if orcid_id in self.orcid_ids:
            self.orcid_ids[orcid_id][0].add(orcid_scope_uuid)
        else:
            self.orcid_ids[orcid_id] = (set([orcid_scope_uuid]), name)

        self.update_ORCIDiD_db()

    def update_ORCIDiD_db(self) -> None:
        with open(os.path.join(self.config_dir, "ORCID_IDs.txt"), "w") as fh:
            for orcid_id in self.orcid_ids:
                orcid_scope_uuids, name = self.orcid_ids[orcid_id]
                fh.write(f"{orcid_id}\t{','.join(orcid_scope_uuids)}\t{name}\n")

    def get_current_UUIDs(self) -> dict:
        return self.current_UUIDs

    def get_permanent_UUIDs(self) -> set:
        return self.permanent_UUIDs

    def read_permanent_sessions(self) -> bool:
        if os.path.isfile(os.path.join(self.config_dir, "Permanent_Session_IDs.txt")):
            with open(os.path.join(self.config_dir, "Permanent_Session_IDs.txt"), "r") as fh:
                for line in fh.readlines():
                    try:
                        uuid, sessionMode = line.rstrip("\n").split("\t")
                    except Exception as e:
                        LOGGER.error(f"Exception raised {e}")
                        uuid = line.rstrip("\n")
                        sessionMode = "rw"
                    self.permanent_UUIDs.add(uuid)
                    self.current_UUIDs[uuid] = [time.time() + (_ONE_DAY_IN_SECONDS * 365), sessionMode]
            return True
        else:
            return False

    def read_UUID_db(self) -> None:
        LOGGER.debug('Building UUID "database"')
        if os.path.isfile(os.path.join(self.config_dir, "UUID_Timeouts.tsv")):
            LOGGER.debug("Existing User UUIDs:")
            with open(os.path.join(self.config_dir, "UUID_Timeouts.tsv"), "r") as fh:
                for line in fh.readlines():
                    ls = line.rstrip("\n").split("\t")
                    self.current_UUIDs[ls[0]] = [float(ls[1]), "rw"]  # All user sessions are rw
                    LOGGER.debug(
                        f'\tUUID {ls[0]}, mode rw. Generated on {time.strftime("%Y-%m-%d at %H:%M:%S", time.localtime(float(ls[1])))}'
                    )

        if os.path.isfile(os.path.join(self.config_dir, "Permanent_Session_IDs.txt")):
            perm_sessions_exist = self.read_permanent_sessions()
            if perm_sessions_exist:
                for session in self.get_permanent_UUIDs():
                    LOGGER.debug('Existing Permanent Sessions:"')
                    LOGGER.debug(
                        f'\tUUID {session}, mode {self.current_UUIDs[session][1]}. Valid until {time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + (_ONE_DAY_IN_SECONDS * 365)))}'
                    )
        else:
            LOGGER.debug('No Existing Permanent Sessions, generating rw App UUID:"')
            with open(os.path.join(self.config_dir, "Permanent_Session_IDs.txt"), "w") as fh:
                newUUID = "SCopeApp__{0}".format(str(uuid4()))
                fh.write("{0}\trw\n".format(newUUID))  # App sessions are always rw
                self.current_UUIDs[newUUID] = [time.time() + (_ONE_DAY_IN_SECONDS * 365), "rw"]
                LOGGER.debug(
                    f'\tUUID {newUUID}, mode rw. Valid until {time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + (_ONE_DAY_IN_SECONDS * 365)))}'
                )

    def update_UUID_db(self) -> None:
        with open(os.path.join(self.config_dir, "UUID_Timeouts.tsv"), "w") as fh:
            for UUID in self.current_UUIDs.keys():
                if UUID not in self.permanent_UUIDs:
                    fh.write("{0}\t{1}\n".format(UUID, self.current_UUIDs[UUID][0]))
            self.read_permanent_sessions()

    def get_uuid_log(self) -> TextIO:
        return self.uuid_log

    def create_uuid_log(self) -> None:
        self.uuid_log = open(
            os.path.join(self.logs_dir, "UUID_Log_{0}".format(time.strftime("%Y-%m-%d__%H-%M-%S", time.localtime()))),
            "w",
        )

    def get_active_sessions(self) -> dict:
        return self.active_sessions

    def active_session_check(self) -> None:
        curTime = time.time()
        for UUID in list(self.active_sessions.keys()):
            if curTime - self.active_sessions[UUID] > _SESSION_TIMEOUT or UUID not in self.get_current_UUIDs().keys():
                del self.active_sessions[UUID]

    def reset_active_session_timeout(self, UUID) -> None:
        self.active_sessions[UUID] = time.time()

    def load_gene_mappings(self) -> None:
        with (settings.DATA_PATH / "terminal_mappings.pickle").open(mode="rb") as tm_fh:
            self.dmel_mappings = pickle.load(tm_fh)
