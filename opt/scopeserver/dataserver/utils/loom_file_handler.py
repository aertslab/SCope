import os
import loompy as lp
from loompy import LoomConnection
import threading
import collections as c
from pathlib import Path
from typing import Optional

from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils.loom import Loom
import logging

logger = logging.getLogger(__name__)


class LoomFileHandler:
    def __init__(self):
        self.active_looms = {}
        self.file_locks = c.defaultdict(lambda: threading.Lock())
        self.loom_dir = Path(dfh.DataFileHandler.get_data_dir_path_by_file_type(file_type="Loom"))

    def add_loom(self, file_path: Path, abs_file_path: Path, loom_connection) -> Loom:
        loom = Loom(
            file_path=file_path, abs_file_path=abs_file_path, loom_connection=loom_connection, loom_file_handler=self,
        )
        self.active_looms[abs_file_path] = loom
        return loom

    def load_loom_file(self, file_path: Path, abs_file_path: Path, mode: str = "r") -> Optional[Loom]:
        try:
            loom_connection = lp.connect(abs_file_path, mode=mode, validate=False)
            return self.add_loom(file_path=file_path, abs_file_path=abs_file_path, loom_connection=loom_connection,)
        except KeyError as e:
            logger.error(e)
            os.remove(file_path)
            logger.warning(f"Deleting malformed loom {file_path}")
            self.file_locks[abs_file_path].release()
            return None

    def drop_loom(self, loom_file_path: Path) -> Path:
        abs_file_path = self.get_loom_absolute_file_path(loom_file_path)
        del self.active_looms[abs_file_path]
        return abs_file_path

    def change_loom_mode(self, loom_file_path: Path, mode: str = "r", keep_ss: bool = False) -> LoomConnection:
        abs_file_path = self.get_loom_absolute_file_path(loom_file_path)
        if not os.path.exists(abs_file_path):
            raise ValueError(f"The file located at {abs_file_path} does not exist.")

        if abs_file_path in self.active_looms:
            self.active_looms[abs_file_path].get_connection().close()

        if mode == "r+":
            logger.debug(f"Reopening file as {mode}")
            self.active_looms[abs_file_path] = self.get_loom(loom_file_path=loom_file_path, mode="r+")
            logger.info(f"{loom_file_path} now {self.active_looms[abs_file_path].get_connection().mode}")

        else:
            logger.debug(f"Reopening file as r")
            self.active_looms[abs_file_path] = self.get_loom(loom_file_path=loom_file_path)
            logger.info(f"{loom_file_path} now {self.active_looms[abs_file_path].get_connection().mode}")

        return self.active_looms[abs_file_path].get_connection()

    def get_loom_absolute_file_path(self, loom_file_path: Path) -> Path:
        return self.loom_dir / loom_file_path

    def get_global_looms(self) -> list:
        return self.global_looms

    def set_global_data(self) -> None:
        self.global_looms = [x for x in os.listdir(self.loom_dir) if not os.path.isdir(os.path.join(self.loom_dir, x))]

    def get_loom_connection(self, loom_file_path: Path, mode: str = "r") -> LoomConnection:
        logger.debug(f"Getting connection for {loom_file_path} in mode {mode}")
        return self.get_loom(loom_file_path=loom_file_path, mode=mode).get_connection()

    def get_loom(self, loom_file_path: Path, mode: str = "r") -> Loom:
        abs_loom_file_path = self.get_loom_absolute_file_path(loom_file_path)
        with self.file_locks[abs_loom_file_path]:
            if not os.path.exists(abs_loom_file_path):
                logger.error(f"The file {loom_file_path} does not exists.")
                raise ValueError(f"The file located at {abs_loom_file_path} does not exist.")
            if abs_loom_file_path in self.active_looms:
                logger.debug("Should be preloaded")
                loom = self.active_looms[abs_loom_file_path]
                try:
                    logger.debug(
                        f"Current mode: {self.active_looms[abs_loom_file_path].get_connection().mode}, wanted mode {mode}"
                    )
                    if self.active_looms[abs_loom_file_path].get_connection().mode == mode:
                        logger.debug(f"Returning pre-loaded loom file {loom_file_path}. Object {id(loom)}")
                        return loom
                except AttributeError:
                    logger.error("Loom was previously closed")
                    loom.loom_connection = lp.connect(abs_loom_file_path, mode=mode, validate=False)

            else:
                loom = self.load_loom_file(mode=mode, file_path=loom_file_path, abs_file_path=abs_loom_file_path)
                logger.debug(
                    f"Returning newly loaded loom file {loom_file_path}. Object {id(loom)}, mode {loom.get_connection().mode}"
                )
        return loom
