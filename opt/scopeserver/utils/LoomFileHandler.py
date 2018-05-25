import os
import hashlib
import loompy as lp

class LoomFileHandler():

    def __init__(self):
        self.active_loom_connections = {}
        print("Starting LoomFileHandler...")
    
    def add_loom_connection(self, partial_md5_hash, loom):
        self.active_loom_connections[partial_md5_hash] = loom

    def load_loom_file(self, partial_md5_hash, loom_file_path, rw=False):
        # if rw:
        #     loom = lp.connect(loom_file_path, mode='r+')
        # else:
        #     loom = lp.connect(loom_file_path, mode='r')\
        try:
            loom = lp.connect(loom_file_path, mode='r+')
        except KeyError as e:
            print(e)
            os.remove(loom_file_path)
            return None
        self.add_loom_connection(partial_md5_hash, loom)
        return loom

    @staticmethod
    def get_partial_md5_hash(file_path, last_n_kb):
        with open(file_path, 'rb') as f:
            file_size = os.fstat(f.fileno()).st_size
            if file_size < last_n_kb * 1024:
                f.seek(- file_size, 2)
            else:
                f.seek(- last_n_kb * 1024, 2)
            return hashlib.md5(f.read()).hexdigest()
    
    def get_loom_connection(self, loom_file_path):
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        # To check if the given file path is given specified url!
        partial_md5_hash = LoomFileHandler.get_partial_md5_hash(loom_file_path, 10000)
        if partial_md5_hash in self.active_loom_connections:
            return self.active_loom_connections[partial_md5_hash]
        else:
            print("Debug: loading the loom file from " + loom_file_path + "...")
            return self.load_loom_file(partial_md5_hash, loom_file_path)
    
    def change_loom_mode(self, loom_file_path, mode):
        print(loom_file_path)
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        print('{0} getting md5'.format(loom_file_path))
        partial_md5_hash = LoomFileHandler.get_partial_md5_hash(loom_file_path, 10000)
        print('{0} md5 is {1}'.format(loom_file_path, partial_md5_hash))

        if partial_md5_hash in self.active_loom_connections:
            self.active_loom_connections[partial_md5_hash].close()
        if mode == 'rw':
            self.active_loom_connections[partial_md5_hash] = self.get_loom_connection(loom_file_path=loom_file_path) #, rw=True)
            print('{0} now rw'.format(loom_file_path))
        else:
            self.active_loom_connections[partial_md5_hash] = self.get_loom_connection(loom_file_path=loom_file_path) #, rw=False)
            print('{0} now ro'.format(loom_file_path))