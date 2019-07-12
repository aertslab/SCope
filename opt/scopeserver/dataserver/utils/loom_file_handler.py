import os
import hashlib
import loompy as lp

from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils.loom import Loom


class LoomFileHandler():

    def __init__(self):
        self.active_looms = {}
        self.loom_dir = dfh.DataFileHandler.get_data_dir_path_by_file_type(file_type="Loom")

    def add_loom(self, partial_md5_hash, file_path, abs_file_path, loom_connection):
        loom = Loom(partial_md5_hash=partial_md5_hash, file_path=file_path, abs_file_path=abs_file_path, loom_connection=loom_connection)
        self.active_looms[partial_md5_hash] = loom
        return loom

    def load_loom_file(self, partial_md5_hash, file_path, abs_file_path, rw=False):
        # if rw:
        #     loom = lp.connect(file_path, mode='r+')
        # else:
        #     loom = lp.connect(file_path, mode='r')\
        try:
            loom_connection = lp.connect(abs_file_path, mode='r+')
        except KeyError as e:
            print(e)
            os.remove(file_path)
            return None
        return self.add_loom(partial_md5_hash=partial_md5_hash, file_path=file_path, abs_file_path=abs_file_path, loom_connection=loom_connection)

    @staticmethod
    def get_partial_md5_hash(file_path, last_n_kb):
        with open(file_path, 'rb') as f:
            file_size = os.fstat(f.fileno()).st_size
            if file_size < last_n_kb * 1024:
                f.seek(- file_size, 2)
            else:
                f.seek(- last_n_kb * 1024, 2)
            return hashlib.md5(f.read()).hexdigest()

    def change_loom_mode(self, loom_file_path, mode):
        print(loom_file_path)
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        print('{0} getting md5'.format(loom_file_path))
        partial_md5_hash = LoomFileHandler.get_partial_md5_hash(loom_file_path, 10000)
        print('{0} md5 is {1}'.format(loom_file_path, partial_md5_hash))

        if partial_md5_hash in self.active_looms:
            self.active_looms[partial_md5_hash].close()
        if mode == 'rw':
            self.active_looms[partial_md5_hash] = self.get_loom_connection(loom_file_path=loom_file_path)  # , rw=True)
            print('{0} now rw'.format(loom_file_path))
        else:
            self.active_looms[partial_md5_hash] = self.get_loom_connection(loom_file_path=loom_file_path)  # , rw=False)
            print('{0} now ro'.format(loom_file_path))

    def get_loom_absolute_file_path(self, loom_file_path):
        return os.path.join(self.loom_dir, loom_file_path)

    def get_global_looms(self):
        return self.global_looms

    def set_global_data(self):
        self.global_looms = [x for x in os.listdir(self.loom_dir) if not os.path.isdir(os.path.join(self.loom_dir, x))]

    def get_loom_connection(self, loom_file_path):
        return self.get_loom(loom_file_path=loom_file_path).get_connection()

    def get_loom(self, loom_file_path):
        abs_loom_file_path = self.get_loom_absolute_file_path(loom_file_path=loom_file_path)
        if not os.path.exists(abs_loom_file_path):
            raise ValueError('The file located at ' +
                             abs_loom_file_path + ' does not exist.')
        # To check if the given file path is given specified url!
        partial_md5_hash = LoomFileHandler.get_partial_md5_hash(abs_loom_file_path, 10000)
        if partial_md5_hash in self.active_looms:
            return self.active_looms[partial_md5_hash]
        print("Debug: loading the loom file from " + abs_loom_file_path + "...")
        return self.load_loom_file(partial_md5_hash=partial_md5_hash, file_path=loom_file_path, abs_file_path=abs_loom_file_path)
