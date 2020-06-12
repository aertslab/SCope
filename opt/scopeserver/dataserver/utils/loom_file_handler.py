import os
import hashlib
import imohash
import loompy as lp

from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils.loom import Loom
import logging

logger = logging.getLogger(__name__)


class LoomFileHandler:
    def __init__(self):
        self.active_looms = {}
        self.loom_dir = dfh.DataFileHandler.get_data_dir_path_by_file_type(file_type="Loom")

    def add_loom(self, file_hash: str, file_path: str, abs_file_path: str, loom_connection):
        loom = Loom(
            file_hash=file_hash,
            file_path=file_path,
            abs_file_path=abs_file_path,
            loom_connection=loom_connection,
            loom_file_handler=self,
        )
        self.active_looms[abs_file_path] = loom
        return loom

    def load_loom_file(self, file_hash: str, file_path: str, abs_file_path: str, mode: str = "r"):
        try:
            loom_connection = lp.connect(abs_file_path, mode=mode, validate=False)
        except KeyError as e:
            logger.error(e)
            os.remove(file_path)
            logger.warning(f"Deleting malformed loom {file_path}")
            return None
        return self.add_loom(
            file_hash=file_hash, file_path=file_path, abs_file_path=abs_file_path, loom_connection=loom_connection,
        )

    @staticmethod
    def get_file_hash(file_path: str):
        return imohash.hashfile(file_path, hexdigest=True)

    @staticmethod
    def get_partial_md5_hash(file_path: str, last_n_kb: int):
        with open(file_path, "rb") as f:
            file_size = os.fstat(f.fileno()).st_size
            if file_size < last_n_kb * 1024:
                f.seek(-file_size, 2)
            else:
                f.seek(-last_n_kb * 1024, 2)
            return hashlib.md5(f.read() + file_path.encode("ASCII")).hexdigest()

    def drop_loom(self, loom_file_path: str) -> str:
        loom = self.get_loom(loom_file_path=loom_file_path).get_connection().close()
        abs_file_path = self.get_loom_absolute_file_path(loom_file_path)
        del self.active_looms[abs_file_path]
        return abs_file_path

    def change_loom_mode(self, loom_file_path: str, mode: str = "r", file_hash: str = None):
        abs_file_path = self.get_loom_absolute_file_path(loom_file_path)
        if file_hash is None:
            file_hash = LoomFileHandler.get_file_hash(abs_file_path)
        if not os.path.exists(abs_file_path):
            raise ValueError("The file located at " + abs_file_path + " does not exist.")
        logger.info("{0} md5 is {1}".format(abs_file_path, file_hash))

        if abs_file_path in self.active_looms:
            logger.debug(
                f"Found file with hash: {file_hash}. Current mode is {self.active_looms[abs_file_path].get_connection().mode}. Closing."
            )
            self.active_looms[abs_file_path].get_connection().close()

        if mode == "r+":
            logger.debug(f"Reopening file as {mode}")
            self.active_looms[abs_file_path] = self.get_loom(loom_file_path=loom_file_path, mode="r+")
            logger.info(f"{loom_file_path} now {self.active_looms[abs_file_path].get_connection().mode}")

        else:
            logger.debug(f"Reopening file as r")
            self.active_looms[abs_file_path] = self.get_loom(loom_file_path=loom_file_path)
            logger.info(f"{loom_file_path} now {self.active_looms[abs_file_path].get_connection().mode}")

        logger.debug(f"Checking MD5")
        new_file_hash = LoomFileHandler.get_file_hash(abs_file_path)
        logger.debug(f"Old MD5 is: {file_hash} New MD5 is: {new_file_hash}")

        if file_hash != new_file_hash:
            try:
                os.remove(os.path.join(os.path.dirname(abs_file_path), file_hash + ".ss_pkl"))
            except Exception as e:
                logger.debug("Couldn't remove pickle SS")
                logger.debug(e)
                pass

        return self.active_looms[abs_file_path].get_connection()

    def get_loom_absolute_file_path(self, loom_file_path: str) -> str:
        return os.path.join(self.loom_dir, loom_file_path)

    def get_global_looms(self) -> list:
        return self.global_looms

    def set_global_data(self) -> None:
        self.global_looms = [x for x in os.listdir(self.loom_dir) if not os.path.isdir(os.path.join(self.loom_dir, x))]

    def get_loom_connection(self, loom_file_path: str, mode: str = "r"):
        logger.debug(f"Getting connection for {loom_file_path} in mode {mode}")
        return self.get_loom(loom_file_path=loom_file_path, mode=mode).get_connection()

    def get_loom(self, loom_file_path: str, mode: str = "r"):
        abs_loom_file_path = self.get_loom_absolute_file_path(loom_file_path)
        if not os.path.exists(abs_loom_file_path):
            logger.error(f"The file {loom_file_path} does not exists.")
            raise ValueError("The file located at " + abs_loom_file_path + " does not exist.")
        # To check if the given file path is given specified url!
        file_hash = LoomFileHandler.get_file_hash(abs_loom_file_path)
        if abs_loom_file_path in self.active_looms:
            current_loom_file_hash = self.active_looms[abs_loom_file_path].get_file_hash()
            if current_loom_file_hash != file_hash:
                logger.info(f"Update required for Loom {loom_file_path}")
                try:
                    os.remove(os.path.join(os.path.dirname(abs_loom_file_path), current_loom_file_hash + ".ss_pkl"))
                    self.active_looms[abs_loom_file_path].close()
                    del self.active_looms[abs_loom_file_path]
                except OSError as err:
                    logger.error(f"Could not delete search space pickle from {loom_file_path}. {err}")
            else:
                logger.debug("Should be preloaded")
                try:
                    logger.debug(
                        f"Current mode: {self.active_looms[abs_loom_file_path].get_connection().mode}, wanted mode {mode}"
                    )

                    if self.active_looms[abs_loom_file_path].get_connection().mode == mode:
                        loom = self.active_looms[abs_loom_file_path]
                        logger.debug(
                            f"Returning pre-loaded loom file {loom_file_path}. Hash {file_hash}, object {id(loom)}"
                        )
                        return loom
                except AttributeError:
                    logger.error("Loom was previously closed")

        loom = self.load_loom_file(
            file_hash=file_hash, mode=mode, file_path=loom_file_path, abs_file_path=abs_loom_file_path
        )
        logger.debug(f"Returning newly loaded loom file {loom_file_path}. Hash {file_hash}, object {id(loom)}")
        return loom
