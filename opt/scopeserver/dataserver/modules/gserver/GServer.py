from concurrent import futures
import sys
import time
import grpc
import loompy as lp
import hashlib
import os
import re
import numpy as np
import pandas as pd
import shutil
import json
import zlib
import base64
import threading
import pickle
import uuid
from appdirs import AppDirs
from collections import OrderedDict, defaultdict
from functools import lru_cache
from itertools import compress
from pathlib import Path

from scopeserver.dataserver.modules.gserver import s_pb2
from scopeserver.dataserver.modules.gserver import s_pb2_grpc
from scopeserver.utils import SysUtils as su

from pyscenic.genesig import GeneSignature
from pyscenic.aucell import create_rankings, enrichment, enrichment4cells

_ONE_DAY_IN_SECONDS = 60 * 60 * 24
_UUID_TIMEOUT = _ONE_DAY_IN_SECONDS * 5
_SESSION_TIMEOUT = 60 * 5
_ACTIVE_SESSIONS_LIMIT = 25
_MOUSE_EVENTS_THRESHOLD = 1
_LOWER_LIMIT_RGB = 0
_UPPER_LIMIT_RGB = 225
_NO_EXPR_RGB = 166

appName = 'SCope'
appAuthor = 'Aertslab'
appVersion = '1.0'


BIG_COLOR_LIST = ["ff0000", "ffc480", "149900", "307cbf", "d580ff", "cc0000", "bf9360", "1d331a", "79baf2", "deb6f2",
                  "990000", "7f6240", "283326", "2d4459", "8f00b3", "4c0000", "ccb499", "00f220", "accbe6", "520066",
                  "330000", "594f43", "16591f", "697c8c", "290033", "cc3333", "e59900", "ace6b4", "262d33", "ee00ff",
                  "e57373", "8c5e00", "2db350", "295ba6", "c233cc", "994d4d", "664400", "336641", "80b3ff", "912699",
                  "663333", "332200", "86b392", "4d6b99", "3d1040", "bf8f8f", "cc9933", "4d6653", "202d40", "c566cc",
                  "8c6969", "e5bf73", "008033", "0044ff", "944d99", "664d4d", "594a2d", "39e67e", "00144d", "a37ca6",
                  "f2553d", "403520", "30bf7c", "3d6df2", "ff80f6", "a63a29", "ffeabf", "208053", "2d50b3", "73396f",
                  "bf6c60", "736956", "134d32", "13224d", "4d264a", "402420", "f2c200", "53a67f", "7391e6", "735671",
                  "ffc8bf", "8c7000", "003322", "334166", "40303f", "ff4400", "ccad33", "3df2b6", "a3b1d9", "ff00cc",
                  "b23000", "594c16", "00bf99", "737d99", "8c0070", "7f2200", "ffe680", "66ccb8", "393e4d", "331a2e",
                  "591800", "b2a159", "2d5950", "00138c", "ffbff2", "330e00", "7f7340", "204039", "364cd9", "b30077",
                  "ff7340", "ffee00", "b6f2e6", "1d2873", "40002b", "cc5c33", "403e20", "608079", "404880", "e639ac",
                  "994526", "bfbc8f", "00998f", "1a1d33", "731d56", "f29979", "8c8a69", "00736b", "0000f2", "ff80d5",
                  "8c5946", "778000", "39e6da", "0000d9", "a6538a", "59392d", "535900", "005359", "0000bf", "f20081",
                  "bf9c8f", "3b4000", "003c40", "2929a6", "660036", "735e56", "ced936", "30b6bf", "bfbfff", "bf8fa9",
                  "403430", "fbffbf", "23858c", "8273e6", "d90057", "f26100", "ccff00", "79eaf2", "332d59", "a60042",
                  "bf4d00", "cfe673", "7ca3a6", "14004d", "bf3069", "331400", "8a994d", "394b4d", "170d33", "8c234d",
                  "ff8c40", "494d39", "005266", "a799cc", "bf6086", "995426", "a3d936", "39c3e6", "7d7399", "804059",
                  "733f1d", "739926", "23778c", "290066", "59434c", "f2aa79", "88ff00", "0d2b33", "8c40ff", "b20030",
                  "b27d59", "3d7300", "59a1b3", "622db3", "7f0022", "7f5940", "294d00", "acdae6", "2a134d", "40101d",
                  "33241a", "4e6633", "566d73", "7453a6", "f27999", "ffd9bf", "bfd9a3", "00aaff", "4c4359", "4d2630",
                  "8c7769", "92a67c", "006699", "2b2633", "ffbfd0", "ff8800", "52cc00", "002b40", "6d00cc", "99737d",
                  "a65800", "234010", "3399cc", "4b008c", "33262a", "663600", "a1ff80", "86a4b3", "9c66cc", "7f0011",
                  "331b00", "79bf60", "007ae6", "583973", "f23d55", "cc8533", "518040", "003059", "312040", "59161f",
                  "4c3213", "688060", "001b33", "69238c", "bf606c"]

hexarr = np.vectorize('{:02x}'.format)

platformDirs = AppDirs(appname=appName, appauthor=appAuthor)

data_dirs = {"Loom": {"path": os.path.join(platformDirs.user_data_dir, "my-looms"),
                      "message": "No data folder detected. Making loom data folder: {0}.".format(str(os.path.join(platformDirs.user_data_dir, "my-looms")))},
             "GeneSet": {"path": os.path.join(platformDirs.user_data_dir, "my-gene-sets"),
                         "message": "No gene-sets folder detected. Making gene-sets data folder in current directory: {0}.".format(str(os.path.join(platformDirs.user_data_dir, "my-gene-sets")))},
             "LoomAUCellRankings": {"path": os.path.join(platformDirs.user_data_dir, "my-aucell-rankings"),
                                    "message": "No AUCell rankings folder detected. Making AUCell rankings data folder in current directory: {0}.".format(str(os.path.join(platformDirs.user_data_dir, "my-aucell-rankings")))},
             "Config": {"path": os.path.join(platformDirs.user_config_dir),
                        "message": "No Config folder detected. Making Config folder: {0}.".format(str(os.path.join(platformDirs.user_config_dir)))},
             "Logs": {"path": os.path.join(platformDirs.user_log_dir),
                      "message": "No Logs folder detected. Making Logs folder: {0}.".format(str(os.path.join(platformDirs.user_log_dir)))}}

curUUIDs = {}
permUUIDs = set()
uploadedLooms = defaultdict(lambda: set())
activeSessions = {}


class SCope(s_pb2_grpc.MainServicer):

    def __init__(self):

        SCope.create_global_dirs()

        self.data_dirs = data_dirs
        self.active_loom_connections = {}
        self.loom_dir = SCope.get_data_dir_path_by_file_type("Loom")
        self.gene_sets_dir = SCope.get_data_dir_path_by_file_type("GeneSet")
        self.rankings_dir = SCope.get_data_dir_path_by_file_type("LoomAUCellRankings")
        self.config_dir = SCope.get_data_dir_path_by_file_type("Config")
        self.logs_dir = SCope.get_data_dir_path_by_file_type("Logs")

        SCope.load_gene_mappings()
        self.create_uuid_log()
        self.set_global_data()
        self.readUUIDdb()

    @staticmethod
    def dfToNamedMatrix(df):
        arr_ip = [tuple(i) for i in df.as_matrix()]
        dtyp = np.dtype(list(zip(df.dtypes.index, df.dtypes)))
        arr = np.array(arr_ip, dtype=dtyp)
        return arr

    @staticmethod
    def load_gene_mappings():
        gene_mappings_dir_path = os.path.join(Path(__file__).parents[3], 'dataserver', 'data', 'gene_mappings') if SCope.devEnv else os.path.join(Path(__file__).parents[6], 'data', 'gene_mappings')
        SCope.dmel_mappings = pickle.load(open(os.path.join(gene_mappings_dir_path, 'terminal_mappings.pickle'), 'rb'))
        SCope.hsap_to_dmel_mappings = pickle.load(open(os.path.join(gene_mappings_dir_path, 'hsap_to_dmel_mappings.pickle'), 'rb'))
        SCope.mmus_to_dmel_mappings = pickle.load(open(os.path.join(gene_mappings_dir_path, 'mmus_to_dmel_mappings.pickle'), 'rb'))

    @staticmethod
    def get_data_dir_path_by_file_type(file_type, UUID=None):
        if file_type in ['Loom', 'GeneSet', 'LoomAUCellRankings'] and UUID is not None:
                globalDir = data_dirs[file_type]["path"]
                UUIDDir = os.path.join(globalDir, UUID)
                return UUIDDir
        else:
            return data_dirs[file_type]["path"]

    @staticmethod
    def create_global_dirs():
        for data_type in data_dirs.keys():
            if not os.path.isdir(data_dirs[data_type]["path"]):
                print(data_dirs[data_type]["message"])
                os.makedirs(data_dirs[data_type]["path"])

    @staticmethod
    def get_partial_md5_hash(file_path, last_n_kb):
        with open(file_path, 'rb') as f:
            file_size = os.fstat(f.fileno()).st_size
            if file_size < last_n_kb * 1024:
                f.seek(- file_size, 2)
            else:
                f.seek(- last_n_kb * 1024, 2)
            return hashlib.md5(f.read()).hexdigest()

    def changeLoomMode(self, loom_file_path, mode):
        print(loom_file_path)
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        print('{0} getting md5'.format(loom_file_path))
        partial_md5_hash = SCope.get_partial_md5_hash(loom_file_path, 10000)
        print('{0} md5 is {1}'.format(loom_file_path, partial_md5_hash))

        if partial_md5_hash in self.active_loom_connections:
            self.active_loom_connections[partial_md5_hash].close()
        if mode == 'rw':
            self.active_loom_connections[partial_md5_hash] = self.get_loom_connection(loom_file_path, rw=True)
            print('{0} now rw'.format(loom_file_path))
        else:
            self.active_loom_connections[partial_md5_hash] = self.get_loom_connection(loom_file_path, rw=False)
            print('{0} now ro'.format(loom_file_path))


    @staticmethod
    def activeSessionCheck():
        curTime = time.time()
        for UUID in list(activeSessions.keys()):
            if curTime - activeSessions[UUID] > _SESSION_TIMEOUT or UUID not in curUUIDs:
                del(activeSessions[UUID])

    @staticmethod
    def resetActiveSessionTimeout(UUID):
        activeSessions[UUID] = time.time()

    def readUUIDdb(self):
        if os.path.isfile(os.path.join(self.config_dir, 'UUID_Timeouts.tsv')):
            with open(os.path.join(self.config_dir, 'UUID_Timeouts.tsv'), 'r') as fh:
                for line in fh.readlines():
                    ls = line.rstrip('\n').split('\t')
                    curUUIDs[ls[0]] = float(ls[1])
        if os.path.isfile(os.path.join(self.config_dir, 'Permanent_Session_IDs.txt')):
            with open(os.path.join(self.config_dir, 'Permanent_Session_IDs.txt'), 'r') as fh:
                for line in fh.readlines():
                    permUUIDs.add(line.rstrip('\n'))
                    curUUIDs[line.rstrip('\n')] = time.time() + (_ONE_DAY_IN_SECONDS * 365)
        else:
            with open(os.path.join(self.config_dir, 'Permanent_Session_IDs.txt'), 'w') as fh:
                newUUID = 'SCopeApp__{0}'.format(str(uuid.uuid4()))
                fh.write('{0}\n'.format(newUUID))
                curUUIDs[newUUID] = time.time() + (_ONE_DAY_IN_SECONDS * 365)

    def updateUUIDdb(self):
        with open(os.path.join(self.config_dir, 'UUID_Timeouts.tsv'), 'w') as fh:
            for UUID in curUUIDs.keys():
                if UUID not in permUUIDs:
                    fh.write('{0}\t{1}\n'.format(UUID, curUUIDs[UUID]))
        if os.path.isfile(os.path.join(self.config_dir, 'Permanent_Session_IDs.txt')):
            with open(os.path.join(self.config_dir, 'Permanent_Session_IDs.txt'), 'r') as fh:
                for line in fh.readlines():
                    permUUIDs.add(line.rstrip('\n'))
                    curUUIDs[line.rstrip('\n')] = time.time() + (_ONE_DAY_IN_SECONDS * 365)

    def create_uuid_log(self):
        SCope.uuid_log = open(os.path.join(self.logs_dir, 'UUID_Log_{0}'.format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()))), 'w')

    @staticmethod
    def compress_str_array(str_arr):
        print("Compressing... ")
        str_array_size = sys.getsizeof(str_arr)
        str_array_joint = bytes(''.join(str_arr), 'utf-8')
        str_array_joint_compressed = zlib.compress(str_array_joint, 1)
        str_array_joint_compressed_size = sys.getsizeof(str_array_joint_compressed)
        savings_percent = 1-str_array_joint_compressed_size/str_array_size
        print("Saving "+"{:.2%} of space".format(savings_percent))
        return str_array_joint_compressed

    def set_global_data(self):
        self.globalLooms = [x for x in os.listdir(self.loom_dir) if not os.path.isdir(os.path.join(self.loom_dir, x))]
        self.globalSets = [x for x in os.listdir(self.gene_sets_dir) if not os.path.isdir(os.path.join(self.gene_sets_dir, x))]
        self.globalrankings = [x for x in os.listdir(self.rankings_dir) if not os.path.isdir(os.path.join(self.rankings_dir, x))]

    def add_loom_connection(self, partial_md5_hash, loom):
        self.active_loom_connections[partial_md5_hash] = loom

    def get_loom_filepath(self, loom_file_name):
        return os.path.join(self.loom_dir, loom_file_name)

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

    def get_loom_connection(self, loom_file_path):
        if not os.path.exists(loom_file_path):
            raise ValueError('The file located at ' +
                             loom_file_path + ' does not exist.')
        # To check if the given file path is given specified url!
        partial_md5_hash = SCope.get_partial_md5_hash(
            loom_file_path, 10000)
        if partial_md5_hash in self.active_loom_connections:
            return self.active_loom_connections[partial_md5_hash]
        else:
            print("Debug: loading the loom file from " + loom_file_path + "...")
            return self.load_loom_file(partial_md5_hash, loom_file_path)

    @staticmethod
    def get_meta_data_annotation_by_name(loom, name):
        md_annotations = SCope.get_meta_data_by_key(loom=loom, key="annotations")
        md_annotation = list(filter(lambda x: x["name"] == name, md_annotations))
        if(len(md_annotation) > 1):
            raise ValueError('Multiple annotations matches the given name '+name)
        return md_annotation[0]

    @staticmethod
    def get_meta_data_clustering_by_id(loom, id):
        md_clusterings = SCope.get_meta_data_by_key(loom=loom, key="clusterings")
        md_clustering = list(filter(lambda x: x["id"] == id, md_clusterings))
        if(len(md_clustering) > 1):
            raise ValueError('Multiple clusterings matches the given id '+id)
        return md_clustering[0]

    @staticmethod
    def get_meta_data_by_key(loom, key):
        meta_data = SCope.get_meta_data(loom=loom)
        if key in meta_data.keys():
            md = meta_data[key]
            if key == "embeddings":
                for e in md:  # Fix for malformed embeddings json (R problem)
                    e['id'] = int(e['id'])
            return md
        return []

    @staticmethod
    def has_md_annotations_(meta_data):
        return "annotations" in meta_data

    @staticmethod
    def has_md_annotations(loom):
        if SCope.has_meta_data(loom=loom):
            return SCope.has_md_annotations_(meta_data=SCope.get_meta_data(loom=loom))

    @staticmethod
    def has_md_clusterings_(meta_data):
        return "clusterings" in meta_data

    @staticmethod
    def has_md_clusterings(loom):
        if SCope.has_meta_data(loom=loom):
            return SCope.has_md_clusterings_(meta_data=SCope.get_meta_data(loom=loom))

    @staticmethod
    def has_meta_data(loom):
        return "MetaData" in loom.attrs.keys()

    @staticmethod
    def decompress_meta(meta):
        try:
            meta = meta.decode('ascii')
            return json.loads(zlib.decompress(base64.b64decode(meta)))
        except AttributeError:
            return json.loads(zlib.decompress(base64.b64decode(meta.encode('ascii'))).decode('ascii'))

    @staticmethod
    def get_meta_data(loom):
        md = loom.attrs.MetaData
        if type(md) is np.ndarray:
            md = loom.attrs.MetaData[0]
        try:
            return json.loads(md)
        except json.decoder.JSONDecodeError:
            return SCope.decompress_meta(meta=md)

    def get_file_metadata(self, loom_file_path):
        """Summarize in a dict what feature data the loom file contains.

        Args:
            loom_file_path (str): The file path to the loom file.

        Returns:
            dict: A dictionary defining whether the current implemented features in SCope are available for the loom file with the given loom_file_path.

        """
        loom = self.get_loom_connection(loom_file_path)
        attr_margins = [2,2,2,2,0]
        attr_names = ["RegulonsAUC", "Clusterings", "Embeddings_X", "GeneSets", "MetaData"]
        attr_keys = ["RegulonsAUC", "Clusterings", "ExtraEmbeddings", "GeneSets", "GlobalMeta"]

        def loom_attr_exists(x):
            tmp = {}
            idx = attr_names.index(x)
            margin = attr_margins[idx]
            ha = False
            if margin == 0:
                ha = hasattr(loom.attrs, x)
            elif margin == 1:
                ha = hasattr(loom.ra, x)
            elif margin == 2:
                ha = hasattr(loom.ca, x)
            else:
                raise ValueError("Invalid margin value: "+ margin)
            tmp["has"+attr_keys[idx]] = ha
            return tmp

        md = map(loom_attr_exists, attr_names)
        meta = { k: v for d in md for k, v in d.items() }
        print(meta)
        return meta

    @lru_cache(maxsize=32)
    def infer_species(self, loom_file_path):
        loom = self.get_loom_connection(loom_file_path)
        genes = set(SCope.get_genes(loom))
        maxPerc = 0.0
        maxSpecies = ''
        mappings = {
            'dmel': SCope.dmel_mappings
        }
        for species in mappings.keys():
            intersect = genes.intersection(mappings[species].keys())
            if (len(intersect) / len(genes)) > maxPerc:
                maxPerc = (len(intersect) / len(genes))
                maxSpecies = species
        if maxPerc < 0.5:
            return 'Unknown', {}
        return maxSpecies, mappings[maxSpecies]

    def get_nb_cells(self, loom_file_path):
        loom = self.get_loom_connection(loom_file_path)
        return loom.shape[1]

    @staticmethod
    def get_genes(loom):
        return loom.ra.Gene.astype(str)

    def get_gene_expression(self, loom_file_path, gene_symbol, log_transform=True, cpm_normalise=False, annotation='', logic='OR'):
        loom = self.get_loom_connection(loom_file_path)
        if gene_symbol not in set(SCope.get_genes(loom)):
            gene_symbol = self.get_gene_names(loom_file_path)[gene_symbol]
        print("Debug: getting expression of " + gene_symbol + "...")
        gene_expr = loom[SCope.get_genes(loom) == gene_symbol, :][0]
        if cpm_normalise:
            print("Debug: CPM normalising gene expression...")
            gene_expr = gene_expr / loom.ca.nUMI
        if log_transform:
            print("Debug: log-transforming gene expression...")
            gene_expr = np.log2(gene_expr + 1)
        if len(annotation) > 0:
            cellIndices = self.get_anno_cells(loom_file_path=loom_file_path, annotations=annotation, logic=logic)
            gene_expr = gene_expr[cellIndices]
        else:
            cellIndices = list(range(self.get_nb_cells(loom_file_path)))
        return gene_expr, cellIndices

    @staticmethod
    def has_annotation(loom, name):
        return name in loom.ca.keys()

    @staticmethod
    def get_annotation_by_name(loom, name):
        if SCope.has_annotation(loom=loom, name=name):
            return loom.ca[name]
        raise ValueError("The given annotation {0} does not exists in the .loom.".format(name))

    @staticmethod
    def has_regulons_AUC(loom):
        return "RegulonsAUC" in loom.ca.keys()

    @staticmethod
    def get_regulons_AUC(loom):
        L = loom.ca.RegulonsAUC.dtype.names
        loom.ca.RegulonsAUC.dtype.names = list(map(lambda s: s.replace(' ', '_'), L))
        return loom.ca.RegulonsAUC

    def get_auc_values(self, loom_file_path, regulon, annotation='', logic='OR'):
        loom = self.get_loom_connection(loom_file_path)
        print("Debug: getting AUC values for {0} ...".format(regulon))
        cellIndices = list(range(self.get_nb_cells(loom_file_path)))
        if regulon in SCope.get_regulons_AUC(loom).dtype.names:
            vals = SCope.get_regulons_AUC(loom)[regulon]
            if len(annotation) > 0:
                cellIndices = self.get_anno_cells(loom_file_path=loom_file_path, annotations=annotation, logic=logic)
                vals = vals[cellIndices]
            return vals, cellIndices
        return [], cellIndices

    def get_clusterIDs(self, loom_file_path, clusterID):
        loom = self.get_loom_connection(loom_file_path)
        return loom.ca.Clusterings[str(clusterID)]

    def get_annotation(self, loom_file_path, annoName):
        loom = self.get_loom_connection(loom_file_path)
        return loom.ca[annoName]

    @lru_cache(maxsize=8)
    def get_gene_names(self, loom_file_path):
        loom = self.get_loom_connection(loom_file_path)
        genes = SCope.get_genes(loom)
        conversion = {}
        species, geneMappings = self.infer_species(loom_file_path)
        for gene in genes:
            gene = str(gene)
            try:
                if geneMappings[gene] != gene:
                    conversion[geneMappings[gene]] = gene
            except KeyError:
                print("ERROR: Gene: {0} is not in the mapping table!".format(gene))
        return conversion

    @lru_cache(maxsize=16)
    def build_searchspace(self, loom_file_path, cross_species=''):
        start_time = time.time()
        species, gene_mappings = self.infer_species(loom_file_path)
        loom = self.get_loom_connection(loom_file_path)
        if SCope.has_meta_data(loom):
            meta_data = SCope.get_meta_data(loom)

        def add_element(search_space, elements, element_type):
            if type(elements) != str:
                for element in elements:
                    if element_type == 'gene' and cross_species == '' and len(gene_mappings) > 0:
                        if gene_mappings[element] != element:
                            search_space[('{0}'.format(str(element)).casefold(), element, element_type)] = gene_mappings[element]
                        else:
                            search_space[(element.casefold(), element, element_type)] = element
                    else:
                        search_space[(element.casefold(), element, element_type)] = element
            else:
                search_space[(elements.casefold(), elements, element_type)] = elements
            return search_space

        search_space = {}

        # Include all features (clusterings, regulons, annotations, ...) into the search space
        # if and only if the query is not a cross-species query
        if cross_species == 'hsap' and species == 'dmel':
            search_space = add_element(search_space, SCope.hsap_to_dmel_mappings.keys(), 'gene')
        elif cross_species == 'mmus' and species == 'dmel':
            search_space = add_element(search_space, SCope.mmus_to_dmel_mappings.keys(), 'gene')
        else:
            if len(gene_mappings) > 0:
                genes = set(SCope.get_genes(loom))
                shrink_mappings = set([x for x in SCope.dmel_mappings.keys() if x in genes or SCope.dmel_mappings[x] in genes])
                # search_space = add_element(search_space, SCope.dmel_mappings.keys(), 'gene')
                search_space = add_element(search_space, shrink_mappings, 'gene')
            else:
                search_space = add_element(search_space, SCope.get_genes(loom), 'gene')

            # Add clusterings to the search space if present in .loom
            if SCope.has_md_clusterings_(meta_data=meta_data):
                for clustering in meta_data['clusterings']:
                    allClusters = ['All Clusters']
                    for cluster in clustering['clusters']:
                        allClusters.append(cluster['description'])
                    search_space = add_element(search_space, allClusters, 'Clustering: {0}'.format(clustering['name']))
            
            # Add regulons to the search space if present in .loom
            if SCope.has_regulons_AUC(loom=loom):
                search_space = add_element(search_space, SCope.get_regulons_AUC(loom).dtype.names, 'regulon')
            else:
                print("No regulons found in the .loom file.")

            # Add annotations to the search space if present in .loom
            if SCope.has_md_annotations_(meta_data=meta_data):
                annotations = []
                for annotation in meta_data['annotations']:
                    annotations.append(annotation['name'])
                search_space = add_element(search_space, annotations, 'annotation')

        print("Debug: %s seconds elapsed making search space ---" % (time.time() - start_time))
        #  Dict, keys = tuple(elementCF, element, elementName), values = element/translastedElement
        return search_space

    @lru_cache(maxsize=256)
    def get_features(self, loom_file_path, query):
        print(query)
        if query.startswith('hsap\\'):
            searchSpace = self.build_searchspace(loom_file_path, crossSpecies='hsap')
            crossSpecies = 'hsap'
            query = query[5:]
        elif query.startswith('mmus\\'):
            searchSpace = self.build_searchspace(loom_file_path, crossSpecies='mmus')
            crossSpecies = 'mmus'
            query = query[5:]
        else:
            searchSpace = self.build_searchspace(loom_file_path)
            crossSpecies = ''
        print(query)

        # Filter the genes by the query

        # Allow caps innsensitive searching, minor slowdown
        start_time = time.time()
        res = []

        queryCF = query.casefold()
        res = [x for x in searchSpace.keys() if queryCF in x[0]]

        for n, r in enumerate(res):
            if query in r[0]:
                r = res.pop(n)
                res = [r] + res
        for n, r in enumerate(res):
            if r[0].startswith(queryCF):
                r = res.pop(n)
                res = [r] + res
        for n, r in enumerate(res):
            if r[0] == queryCF:
                r = res.pop(n)
                res = [r] + res
        for n, r in enumerate(res):
            if r[1] == query:
                r = res.pop(n)
                res = [r] + res

        # These structures are a bit messy, but still fast
        # r = (elementCF, element, elementName)
        # dg = (drosElement, %match)
        # searchSpace[r] = translastedElement
        collapsedResults = OrderedDict()
        if crossSpecies == '':
            for r in res:
                if (searchSpace[r], r[2]) not in collapsedResults.keys():
                    collapsedResults[(searchSpace[r], r[2])] = [r[1]]
                else:
                    collapsedResults[(searchSpace[r], r[2])].append(r[1])
        elif crossSpecies == 'hsap':
            for r in res:
                for dg in SCope.hsap_to_dmel_mappings[searchSpace[r]]:
                    if (dg[0], r[2]) not in collapsedResults.keys():
                        collapsedResults[(dg[0], r[2])] = (r[1], dg[1])
        elif crossSpecies == 'mmus':
            for r in res:
                for dg in SCope.mmus_to_dmel_mappings[searchSpace[r]]:
                    if (dg[0], r[2]) not in collapsedResults.keys():
                        collapsedResults[(dg[0], r[2])] = (r[1], dg[1])

        descriptions = []
        if crossSpecies == '':
            for r in collapsedResults.keys():
                synonyms = sorted([x for x in collapsedResults[r]])
                try:
                    synonyms.remove(r[0])
                except ValueError:
                    pass
                if len(synonyms) > 0:
                    descriptions.append('Synonym of: {0}'.format(', '.join(synonyms)))
                else:
                    descriptions.append('')
        elif crossSpecies == 'hsap':
            for r in collapsedResults.keys():
                descriptions.append('Orthologue of {0}, {1:.2f}% identity (Human -> Drosophila)'.format(collapsedResults[r][0], collapsedResults[r][1]))
        elif crossSpecies == 'mmus':
            for r in collapsedResults.keys():
                descriptions.append('Orthologue of {0}, {1:.2f}% identity (Mouse -> Drosophila)'.format(collapsedResults[r][0], collapsedResults[r][1]))
        # if mapping[result] != result: change title and description to indicate synonym

        print("Debug: " + str(len(res)) + " genes matching '" + query + "'")
        print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        res = {'feature': [r[0] for r in collapsedResults.keys()],
               'featureType': [r[1] for r in collapsedResults.keys()],
               'featureDescription': descriptions}
        return res

    def get_anno_cells(self, loom_file_path, annotations, logic='OR'):
        loom = self.get_loom_connection(loom_file_path)
        cellIndices = []
        for anno in annotations:
            annoName = anno.name
            for annotationValue in anno.values:
                annoSet = set()
                if annoName.startswith("Clustering_"):
                    clusteringID = str(annoName.split('_')[1])
                    [annoSet.add(x) for x in np.where(loom.ca.Clusterings[clusteringID] == annotationValue)[0]]
                else:
                    [annoSet.add(x) for x in np.where(loom.ca[annoName] == annotationValue)[0]]
                cellIndices.append(annoSet)
        if logic not in ['AND', 'OR']:
            logic = 'OR'
        if logic == 'AND':
            return sorted(list(set.intersection(*cellIndices)))
        elif logic == 'OR':
            return sorted(list(set.union(*cellIndices)))

    def get_coordinates(self, loom_file_path, coordinatesID=-1, annotation='', logic='OR'):
        loom = self.get_loom_connection(loom_file_path)
        dims = 0
        if coordinatesID == -1:
            try:
                embedding = loom.ca['Embedding']
                x = embedding['_X']
                y = embedding['_Y']
            except AttributeError:
                try:
                    x = loom.ca['_tSNE1']
                    y = loom.ca['_tSNE2']
                    if len(set(x)) == 1 or len(set(y)) == 1:
                        raise AttributeError
                except AttributeError:
                    try:
                        x = loom.ca['_X']
                        y = loom.ca['_Y']
                        if len(set(x)) == 1 or len(set(y)) == 1:
                            raise AttributeError
                    except AttributeError:
                        x = [n for n in range(len(loom.shape[1]))]
                        y = [n for n in range(len(loom.shape[1]))]
                # for ca in loom.ca.keys():
                    # if 'tSNE'.casefold() in ca.casefold():
                    #     print(ca)
                    #     if dims == 0:
                    #         x = loom.ca[ca]
                    #         dims += 1
                    #         continue
                    #     if dims == 1:
                    #         y = loom.ca[ca]
                    #         dims += 1
                    #         continue
        else:
            x = loom.ca.Embeddings_X[str(coordinatesID)]
            y = loom.ca.Embeddings_Y[str(coordinatesID)]
        if len(annotation) > 0:
            cellIndices = self.get_anno_cells(loom_file_path=loom_file_path, annotations=annotation, logic=logic)
            x = x[cellIndices]
            y = y[cellIndices]
        else:
            cellIndices = list(range(self.get_nb_cells(loom_file_path)))
        return {"x": x,
                "y": -y,
                "cellIndices": cellIndices}

    def compressHexColor(self, a):
        a = int(a, 16)
        a_hex3d = hex(a >> 20 << 8 | a >> 8 & 240 | a >> 4 & 15)
        return a_hex3d.replace("0x", "")

    # Should be static method
    def get_vmax(self, vals):
        maxVmax = max(vals)
        vmax = np.percentile(vals, 99)
        if vmax == 0 and max(vals) != 0:
            vmax = max(vals)
        if vmax == 0:
            vmax = 0.01
        return vmax, maxVmax

    def getVmax(self, request, context):
        vmax = np.zeros(3)
        maxVmax = np.zeros(3)

        for n, feature in enumerate(request.feature):
            fVmax = 0
            fMaxVmax = 0
            if feature != '':
                for loomFilePath in request.loomFilePath:
                    lVmax = 0
                    lMaxVmax = 0
                    if request.featureType[n] == 'gene':
                            vals, cellIndices = self.get_gene_expression(
                                loom_file_path=self.get_loom_filepath(loomFilePath),
                                gene_symbol=feature,
                                log_transform=request.hasLogTransform,
                                cpm_normalise=request.hasCpmTransform)
                            lVmax, lMaxVmax = self.get_vmax(vals)
                    if request.featureType[n] == 'regulon':
                            vals, cellIndices = self.get_auc_values(loom_file_path=self.get_loom_filepath(loomFilePath),
                                                                    regulon=feature)
                            lVmax, lMaxVmax = self.get_vmax(vals)
                    if lVmax > fVmax:
                        fVmax = lVmax
                if lMaxVmax > fMaxVmax:
                    fMaxVmax = lMaxVmax
            vmax[n] = fVmax
            maxVmax[n] = fMaxVmax
        return s_pb2.VmaxReply(vmax=vmax, maxVmax=maxVmax)

    def getCellColorByFeatures(self, request, context):
        start_time = time.time()
        loomFilePath = self.get_loom_filepath(request.loomFilePath)
        loom = self.get_loom_connection(loomFilePath)
        meta_data = SCope.get_meta_data(loom)
        if not os.path.isfile(loomFilePath):
            return
        n_cells = self.get_nb_cells(loomFilePath)
        features = []
        hex_vec = []
        vmax = np.zeros(3)
        maxVmax = np.zeros(3)
        cellIndices = list(range(n_cells))

        for n, feature in enumerate(request.feature):
            if request.featureType[n] == 'gene':
                if feature != '':
                    vals, cellIndices = self.get_gene_expression(
                        loom_file_path=loomFilePath,
                        gene_symbol=feature,
                        log_transform=request.hasLogTransform,
                        cpm_normalise=request.hasCpmTransform,
                        annotation=request.annotation,
                        logic=request.logic)
                    if request.vmax[n] != 0.0:
                        vmax[n] = request.vmax[n]
                    else:
                        vmax[n], maxVmax[n] = self.get_vmax(vals)
                    # vals = np.round((vals / vmax[n]) * 225)
                    vals = vals / vmax[n]
                    vals = (((_UPPER_LIMIT_RGB - _LOWER_LIMIT_RGB) * (vals - min(vals))) / (1 - min(vals))) + _LOWER_LIMIT_RGB
                    features.append([x if x <= _UPPER_LIMIT_RGB else _UPPER_LIMIT_RGB for x in vals])
                else:
                    features.append(np.zeros(n_cells))
            elif request.featureType[n] == 'regulon':
                if feature != '':
                    vals, cellIndices = self.get_auc_values(loom_file_path=loomFilePath,
                                                            regulon=feature,
                                                            annotation=request.annotation,
                                                            logic=request.logic)
                    if request.vmax[n] != 0.0:
                        vmax[n] = request.vmax[n]
                    else:
                        vmax[n], maxVmax[n] = self.get_vmax(vals)
                    if request.scaleThresholded:
                        vals = ([auc if auc >= request.threshold[n] else 0 for auc in vals])
                        # vals = np.round((vals / vmax[n]) * 225)
                        vals = vals / vmax[n]
                        vals = (((_UPPER_LIMIT_RGB - _LOWER_LIMIT_RGB) * (vals - min(vals))) / (1 - min(vals))) + _LOWER_LIMIT_RGB
                        features.append([x if x <= _UPPER_LIMIT_RGB else _UPPER_LIMIT_RGB for x in vals])
                    else:
                        features.append([_UPPER_LIMIT_RGB if auc >= request.threshold[n] else 0 for auc in vals])
                else:
                    features.append(np.zeros(n_cells))
            elif request.featureType[n] == 'annotation':
                md_annotation_values = SCope.get_meta_data_annotation_by_name(loom=loom, name=feature)["values"]
                ca_annotation = SCope.get_annotation_by_name(loom=loom, name=feature)
                ca_annotation_as_int = list(map(lambda x: md_annotation_values.index(x), ca_annotation))
                num_annotations = max(ca_annotation_as_int)
                if num_annotations <= len(BIG_COLOR_LIST):
                    for i in ca_annotation_as_int:
                       hex_vec.append(BIG_COLOR_LIST[i])
                else:
                    raise ValueError("The annotation {0} has too many unique values.".format(feature))
                return s_pb2.CellColorByFeaturesReply(color=hex_vec, vmax=vmax)
            elif request.featureType[n].startswith('Clustering: '):
                for clustering in meta_data['clusterings']:
                    if clustering['name'] == re.sub('^Clustering: ', '', request.featureType[n]):
                        clusteringID = str(clustering['id'])
                        if request.feature[n] == 'All Clusters':
                            numClusters = max(loom.ca.Clusterings[clusteringID])
                            if numClusters <= 245:
                                for i in loom.ca.Clusterings[clusteringID]:
                                    hex_vec.append(BIG_COLOR_LIST[i])
                            else:
                                interval = int(16581375 / numClusters)
                                hex_vec = [hex(I)[2:].zfill(6) for I in range(0, numClusters, interval)]
                            if len(request.annotation) > 0:
                                cellIndices = self.get_anno_cells(loom_file_path=loomFilePath, annotations=request.annotation, logic=request.logic)
                                hex_vec = np.array(hex_vec)[cellIndices]
                            return s_pb2.CellColorByFeaturesReply(color=hex_vec, vmax=vmax)
                        else:
                            for cluster in clustering['clusters']:
                                if request.feature[n] == cluster['description']:
                                    clusterID = int(cluster['id'])
                clusterIndices = loom.ca.Clusterings[clusteringID] == clusterID
                clusterCol = np.array([_UPPER_LIMIT_RGB if x else 0 for x in clusterIndices])
                if len(request.annotation) > 0:
                    cellIndices = self.get_anno_cells(loom_file_path=loomFilePath, annotations=request.annotation, logic=request.logic)
                    clusterCol = clusterCol[cellIndices]
                features.append(clusterCol)
            else:
                features.append([_LOWER_LIMIT_RGB for n in range(n_cells)])
        if len(features) > 0 and len(hex_vec) == 0:
            hex_vec = ["XXXXXX" if r == g == b == 0 # previously null: ???
                       else "{0:02x}{1:02x}{2:02x}".format(int(r), int(g), int(b))
                       for r, g, b in zip(features[0], features[1], features[2])]

        # Compress
        comp_start_time = time.time()
        hex_vec_compressed = SCope.compress_str_array(str_arr=hex_vec)
        print("Debug: %s seconds elapsed (compression) ---" % (time.time() - comp_start_time))

        print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        return s_pb2.CellColorByFeaturesReply(color=hex_vec,
                                              compressedColor=None,
                                              hasAddCompressionLayer=False,
                                              vmax=vmax,
                                              maxVmax=maxVmax,
                                              cellIndices=cellIndices)

    def getCellAUCValuesByFeatures(self, request, context):
        loomFilePath = self.get_loom_filepath(request.loomFilePath)
        vals, cellIndices = self.get_auc_values(loom_file_path=loomFilePath, regulon=request.feature[0])
        return s_pb2.CellAUCValuesByFeaturesReply(value=vals)

    def getCellMetaData(self, request, context):
        loomFilePath = self.get_loom_filepath(request.loomFilePath)
        cellIndices = request.cellIndices
        if len(cellIndices) == 0:
            cellIndices = list(range(self.get_nb_cells(loomFilePath)))

        cellClusters = []
        for cluster in request.clusterings:
            if cluster != '':
                cellClusters.append(self.get_clusterIDs(loom_file_path=loomFilePath,
                                                        clusterID=cluster)[cellIndices])
        geneExp = []
        for gene in request.selectedGenes:
            if gene != '':
                vals, _ = self.get_gene_expression(loom_file_path=loomFilePath,
                                                   gene_symbol=gene,
                                                   log_transform=request.hasLogTransform,
                                                   cpm_normalise=request.hasCpmTransform)
                geneExp.append(vals[cellIndices])
        aucVals = []
        for regulon in request.selectedRegulons:
            if regulon != '':
                vals, _ = aucVals.append(self.get_auc_values(loom_file_path=loomFilePath,
                                                             regulon=regulon))
                aucVals.append(vals[[cellIndices]])
        annotations = []
        for anno in request.annotations:
            if anno != '':
                annotations.append(self.get_annotation(loom_file_path=loomFilePath,
                                                       annoName=anno)[cellIndices])

        return s_pb2.CellMetaDataReply(clusterIDs=[s_pb2.CellClusters(clusters=x) for x in cellClusters],
                                       geneExpression=[s_pb2.FeatureValues(features=x) for x in geneExp],
                                       aucValues=[s_pb2.FeatureValues(features=x) for x in aucVals],
                                       annotations=[s_pb2.CellAnnotations(annotations=x) for x in annotations])

    def getFeatures(self, request, context):
        f = self.get_features(self.get_loom_filepath(request.loomFilePath), request.query)
        return s_pb2.FeatureReply(feature=f['feature'], featureType=f['featureType'], featureDescription=f['featureDescription'])

    def getCoordinates(self, request, context):
        # request content
        c = self.get_coordinates(self.get_loom_filepath(request.loomFilePath),
                                 coordinatesID=request.coordinatesID,
                                 annotation=request.annotation,
                                 logic=request.logic)
        return s_pb2.CoordinatesReply(x=c["x"], y=c["y"], cellIndices=c["cellIndices"])

    def getRegulonMetaData(self, request, context):
        loom = self.get_loom_connection(self.get_loom_filepath(request.loomFilePath))
        regulonGenes = SCope.get_genes(loom)[loom.ra.Regulons[request.regulon] == 1]
        meta_data = SCope.get_meta_data(loom=loom)
        for regulon in meta_data['regulonThresholds']:
            if regulon['regulon'] == request.regulon:
                autoThresholds = []
                for threshold in regulon['allThresholds'].keys():
                    autoThresholds.append({"name": threshold, "threshold": regulon['allThresholds'][threshold]})
                defaultThreshold = regulon['defaultThresholdName']
                motifName = os.path.basename(regulon['motifData'])
                break

        regulon = {"genes": regulonGenes,
                   "autoThresholds": autoThresholds,
                   "defaultThreshold": defaultThreshold,
                   "motifName": motifName
                   }

        return s_pb2.RegulonMetaDataReply(regulonMeta=regulon)

    def getMarkerGenes(self, request, context):
        loom = self.get_loom_connection(self.get_loom_filepath(request.loomFilePath))
        genes = SCope.get_genes(loom)[loom.ra["ClusterMarkers_{0}".format(request.clusteringID)][str(request.clusterID)] == 1]
        # Filter the MD clusterings by ID
        md_clustering = SCope.get_meta_data_clustering_by_id(loom=loom, id=request.clusteringID)
        cluster_marker_metrics = None

        if "clusterMarkerMetrics" in md_clustering.keys():
            md_cmm = md_clustering["clusterMarkerMetrics"]
            def create_cluster_marker_metric(metric):
                cluster_marker_metric = loom.row_attrs["ClusterMarkers_{0}_{1}".format(request.clusteringID, metric["accessor"])][str(request.clusterID)]
                cluster_marker_metric_nz =  cluster_marker_metric[cluster_marker_metric != 0]
                return s_pb2.MarkerGenesMetric(accessor=metric["accessor"],
                                               name=metric["name"],
                                               description=metric["description"],
                                               values=cluster_marker_metric_nz)

            cluster_marker_metrics = list(map(create_cluster_marker_metric, md_cmm))

        return(s_pb2.MarkerGenesReply(genes=genes, metrics=cluster_marker_metrics))

    def getMyGeneSets(self, request, context):
        userDir = self.get_data_dir_path_by_file_type('GeneSet', UUID=request.UUID)
        if not os.path.isdir(userDir):
            for i in ['Loom', 'GeneSet', 'LoomAUCellRankings']:
                os.mkdir(os.path.join(data_dirs[i]['path'], request.UUID))

        geneSetsToProcess = sorted(self.globalSets) + sorted([os.path.join(request.UUID, x) for x in os.listdir(userDir)])
        gene_sets = [s_pb2.MyGeneSet(geneSetFilePath=f, geneSetDisplayName=os.path.splitext(os.path.basename(f))[0]) for f in geneSetsToProcess]
        return s_pb2.MyGeneSetsReply(myGeneSets=gene_sets)

    def generateMetaData(self, loom_file_path):
        # Designed to generate metadata from linnarson loom files
        print('Making metadata for {0}'.format(loom_file_path))
        metaJson = {}

        # self.changeLoomMode(loom_file_path, rw=True)
        loom = self.get_loom_connection(loom_file_path)

        # Embeddings
        # Find PCA / tSNE - Catch all 0's ERROR
        metaJson['embeddings'] = [
            {
                "id": -1,
                "name": "Default (_tSNE1/_tSNE2 or _X/_Y)"
            }
        ]

        # Annotations - What goes here?
        metaJson["annotations"] = []
        for anno in ['Age', 'ClusterName', 'Sex', 'Species', 'Strain', 'Tissue']:
            if anno in loom.ca.keys():
                print("Anno: {0} in loom".format(anno))
                if len(set(loom.ca[anno])) != loom.shape[1] and len(set(loom.ca[anno])) > 0:
                    metaJson["annotations"].append({"name": anno, "values": sorted(list(set(loom.ca[anno])))})
                    print(metaJson["annotations"])

        # Clusterings - Anything with cluster in name?
        metaJson["clusterings"] = []
        if 'Clusters' in loom.ca.keys() and 'ClusterName' in loom.ca.keys():
            clusters = set(zip(loom.ca['Clusters'], loom.ca['ClusterName']))
            clusters = [{"id": int(x[0]), "description": x[1]} for x in clusters]

            # loom.ca['Clusterings'] = SCope.dfToNamedMatrix(pd.DataFrame(columns=[0], index=[x for x in range(loom.shape[1])], data=[int(x) for x in loom.ca['Clusters']]))

            clusterDF = pd.DataFrame(columns=["0"], index=[x for x in range(loom.shape[1])])
            clusterDF["0"] = [int(x) for x in loom.ca['Clusters']]
            loom.ca['Clusterings'] = SCope.dfToNamedMatrix(clusterDF)
            print(loom.ca["Clusterings"])
        metaJson["clusterings"].append({
                    "id": 0,
                    "group": "Interpreted",
                    "name": "Clusters + ClusterName",
                    "clusters": clusters
                })
        print(metaJson)

        loom.attrs['MetaData'] = base64.b64encode(zlib.compress(json.dumps(metaJson).encode('ascii'))).decode('ascii')
        # self.changeLoomMode(loom_file_path, rw=False)

    def getMyLooms(self, request, context):
        my_looms = []
        userDir = self.get_data_dir_path_by_file_type('Loom', UUID=request.UUID)
        if not os.path.isdir(userDir):
            for i in ['Loom', 'GeneSet', 'LoomAUCellRankings']:
                os.mkdir(os.path.join(data_dirs[i]['path'], request.UUID))

        self.set_global_data()

        loomsToProcess = sorted(self.globalLooms) + sorted([os.path.join(request.UUID, x) for x in os.listdir(userDir)])

        for f in loomsToProcess:
            if f.endswith('.loom'):
                loom = self.get_loom_connection(self.get_loom_filepath(f))
                if loom is None:
                    continue
                file_meta = self.get_file_metadata(self.get_loom_filepath(f))
                if not file_meta['hasGlobalMeta']:
                    try:
                        self.generateMetaData(self.get_loom_filepath(f))
                    except Exception as e:
                        print(e)

                try:
                    L1 = loom.attrs.SCopeTreeL1
                    L2 = loom.attrs.SCopeTreeL2
                    L3 = loom.attrs.SCopeTreeL3
                except AttributeError:
                    L1 = 'Uncategorized'
                    L2 = L3 = ''
                my_looms.append(s_pb2.MyLoom(loomFilePath=f,
                                             loomDisplayName=os.path.splitext(os.path.basename(f))[0],
                                             cellMetaData=s_pb2.CellMetaData(annotations=SCope.get_meta_data_by_key(loom=loom, key="annotations"),
                                                                             embeddings=SCope.get_meta_data_by_key(loom=loom, key="embeddings"),
                                                                             clusterings=SCope.get_meta_data_by_key(loom=loom, key="clusterings")),
                                             fileMetaData=file_meta,
                                             loomHeierarchy=s_pb2.LoomHeierarchy(L1=L1,
                                                                                 L2=L2,
                                                                                 L3=L3)
                                             )
                                )
        self.updateUUIDdb()

        return s_pb2.MyLoomsReply(myLooms=my_looms)

    def getUUID(self, request, context):
        if SCope.appMode:
            with open(os.path.join(self.config_dir, 'Permanent_Session_IDs.txt'), 'r') as fh:
                newUUID = fh.readline().rstrip('\n')
        else:
            newUUID = str(uuid.uuid4())
        if newUUID not in curUUIDs.keys():
            SCope.uuid_log.write("{0} :: {1} :: New UUID ({2}) assigned.\n".format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()), request.ip, newUUID))
            SCope.uuid_log.flush()
            curUUIDs[newUUID] = time.time()
        return s_pb2.UUIDReply(UUID=newUUID)

    def getRemainingUUIDTime(self, request, context):  # TODO: his function will be called a lot more often, we should reduce what it does.
        curUUIDSet = set(list(curUUIDs.keys()))
        for uid in curUUIDSet:
            timeRemaining = int(_UUID_TIMEOUT - (time.time() - curUUIDs[uid]))
            if timeRemaining < 0:
                print('Removing UUID: {0}'.format(uid))
                del(curUUIDs[uid])
                for i in ['Loom', 'GeneSet', 'LoomAUCellRankings']:
                    shutil.rmtree(os.path.join(data_dirs[i]['path'], uid))
        uid = request.UUID
        if uid in curUUIDs:
            startTime = curUUIDs[uid]
            timeRemaining = int(_UUID_TIMEOUT - (time.time() - startTime))
            SCope.uuid_log.write("{0} :: {1} :: Old UUID ({2}) connected :: Time Remaining - {3}.\n".format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()), request.ip, uid, timeRemaining))
            SCope.uuid_log.flush()
        else:
            try:
                uuid.UUID(uid)
            except (KeyError, AttributeError):
                uid = str(uuid.uuid4())
            SCope.uuid_log.write("{0} :: {1} :: New UUID ({2}) assigned.\n".format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()), request.ip, uid))
            SCope.uuid_log.flush()
            curUUIDs[uid] = time.time()
            timeRemaining = int(_UUID_TIMEOUT)

        SCope.activeSessionCheck()
        if request.mouseEvents >= _MOUSE_EVENTS_THRESHOLD:
            SCope.resetActiveSessionTimeout(uid)

        sessionsLimitReached = False

        if len(activeSessions.keys()) >= _ACTIVE_SESSIONS_LIMIT and uid not in permUUIDs and uid not in activeSessions.keys():
            sessionsLimitReached = True

        if uid not in activeSessions.keys() and not sessionsLimitReached:
            self.resetActiveSessionTimeout(uid)
        return s_pb2.RemainingUUIDTimeReply(UUID=uid, timeRemaining=timeRemaining, sessionsLimitReached=sessionsLimitReached)

    def translateLassoSelection(self, request, context):
        src_loom = self.get_loom_connection(self.get_loom_filepath(request.srcLoomFilePath))
        dest_loom = self.get_loom_connection(self.get_loom_filepath(request.destLoomFilePath))
        src_cell_ids = [src_loom.ca['CellID'][i] for i in request.cellIndices]
        src_fast_index = set(src_cell_ids)
        dest_mask = [x in src_fast_index for x in dest_loom.ca['CellID']]
        dest_cell_indices = list(compress(range(len(dest_mask)), dest_mask))
        return s_pb2.TranslateLassoSelectionReply(cellIndices=dest_cell_indices)

    def getCellIDs(self, request, context):
        loom = self.get_loom_connection(self.get_loom_filepath(request.loomFilePath))
        cell_ids = [loom.ca['CellID'][i] for i in request.cellIndices]
        return s_pb2.CellIDsReply(cellIds=cell_ids)

    def deleteUserFile(self, request, context):
        basename = os.path.basename(request.filePath)
        finalPath = os.path.join(data_dirs[request.fileType]['path'], request.UUID, basename)
        if os.path.isfile(finalPath) and (basename.endswith('.loom') or basename.endswith('.txt')):
            os.remove(finalPath)
            success = True
        else:
            success = False

        return s_pb2.DeleteUserFileReply(deletedSuccessfully=success)

    # Gene set enrichment
    #
    # Threaded makes it slower because of GIL
    #
    def doGeneSetEnrichment(self, request, context):
        gene_set_file_path = os.path.join(self.gene_sets_dir, request.geneSetFilePath)
        gse = GeneSetEnrichment(scope=self,
                                method="AUCell",
                                loom_file_name=request.loomFilePath,
                                gene_set_file_path=gene_set_file_path,
                                annotation='')

        # Running AUCell...
        yield gse.update_state(step=-1, status_code=200, status_message="Running AUCell...", values=None)
        time.sleep(1)

        # Reading gene set...
        yield gse.update_state(step=0, status_code=200, status_message="Reading the gene set...", values=None)
        with open(gse.gene_set_file_path, 'r') as f:
            # Skip first line because it contains the name of the signature
            gs = GeneSignature('Gene Signature #1',
                               'FlyBase', [line.strip() for idx, line in enumerate(f) if idx > 0])
        time.sleep(1)

        if not gse.has_AUCell_rankings():
            # Creating the matrix as DataFrame...
            yield gse.update_state(step=1, status_code=200, status_message="Creating the matrix...", values=None)
            loom = self.get_loom_connection(self.get_loom_filepath(request.loomFilePath))
            dgem = np.transpose(loom[:, :])
            ex_mtx = pd.DataFrame(data=dgem,
                                  index=loom.ca.CellID,
                                  columns=SCope.get_genes(loom))
            # Creating the rankings...
            start_time = time.time()
            yield gse.update_state(step=2.1, status_code=200, status_message="Creating the rankings...", values=None)
            rnk_mtx = create_rankings(ex_mtx=ex_mtx)
            # Saving the rankings...
            yield gse.update_state(step=2.2, status_code=200, status_message="Saving the rankings...", values=None)
            lp.create(gse.get_AUCell_ranking_filepath(), rnk_mtx.as_matrix(), {"CellID": loom.ca.CellID}, {"Gene": self.get_genes(loom)})
            print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        else:
            # Load the rankings...
            yield gse.update_state(step=2, status_code=200, status_message="Rankings exists: loading...", values=None)
            rnk_loom = self.get_loom_connection(gse.get_AUCell_ranking_filepath())
            rnk_mtx = pd.DataFrame(data=rnk_loom[:, :],
                                   index=rnk_loom.ra.CellID,
                                   columns=rnk_loom.ca.Gene)

        # Calculating AUCell enrichment...
        start_time = time.time()
        yield gse.update_state(step=3, status_code=200, status_message="Calculating AUCell enrichment...", values=None)
        aucs = enrichment(rnk_mtx, gs).loc[:, "AUC"].values

        print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        yield gse.update_state(step=4, status_code=200, status_message=gse.get_method() + " enrichment done!", values=aucs)


class GeneSetEnrichment:

    def __init__(self, scope, method, loom_file_name, gene_set_file_path, annotation):
        ''' Constructor
        :type dgem: ndarray
        :param dgem: digital gene expression matrix with cells as columns and genes as rows
        :type gene_set_file_path: str
        :param gene_set_file_path: Absolute file path to the gene set
        '''
        self.scope = scope
        self.method = method
        self.loom_file_name = loom_file_name
        self.loom_file_path = self.scope.get_loom_filepath(loom_file_name)
        self.gene_set_file_path = gene_set_file_path
        self.annotation = annotation
        self.AUCell_rankings_dir = SCope.get_data_dir_path_by_file_type('LoomAUCellRankings')

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
        state = GeneSetEnrichment.State(step=step, status_code=status_code, status_message=status_message, values=values)
        print("Status: " + state.get_status_message())
        if state.get_values() is None:
            return s_pb2.GeneSetEnrichmentReply(progress=s_pb2.Progress(value=state.get_step(), status=state.get_status_message()),
                                                isDone=False,
                                                cellValues=s_pb2.CellColorByFeaturesReply(color=[], vmax=[], maxVmax=[], cellIndices=[]))
        else:
            vmax = np.zeros(3)
            max_vmax = np.zeros(3)
            aucs = state.get_values()
            _vmax = self.scope.get_vmax(aucs)
            vmax[0] = _vmax[0]
            max_vmax[0] = _vmax[1]
            vals = aucs / vmax[0]
            vals = (((_UPPER_LIMIT_RGB - _LOWER_LIMIT_RGB) * (vals - min(vals))) / (1 - min(vals))) + _LOWER_LIMIT_RGB
            hex_vec = ["null" if r == g == b == 0
                       else "{0:02x}{1:02x}{2:02x}".format(int(r), int(g), int(b))
                       for r, g, b in zip(vals, np.zeros(len(aucs)), np.zeros(len(aucs)))]
            if len(self.annotation) > 0:
                cell_indices = self.get_anno_cells(loom_file_path=self.loom_file_path, annotations=annotation, logic=logic)  # This is broken and/or not neccessary
            else:
                cell_indices = list(range(self.scope.get_nb_cells(self.loom_file_path)))
            return s_pb2.GeneSetEnrichmentReply(progress=s_pb2.Progress(value=state.get_step(), status=state.get_status_message()),
                                                isDone=True,
                                                cellValues=s_pb2.CellColorByFeaturesReply(color=hex_vec,
                                                                                          vmax=vmax,
                                                                                          maxVmax=max_vmax,
                                                                                          cellIndices=cell_indices))

    def get_method(self):
            return self.method

    def get_AUCell_ranking_filepath(self):
        AUCell_rankings_file_name = self.loom_file_name.split(".")[0] + "." + "AUCell.rankings.loom"
        return os.path.join(self.AUCell_rankings_dir, AUCell_rankings_file_name)

    def has_AUCell_rankings(self):
        return os.path.exists(self.get_AUCell_ranking_filepath())

    def run_AUCell(self):
        '''
        '''

    def run(self):
        if self.method == "AUCell":
            self.run_AUCell()
        else:
            self.update_state(step=0, status_code=404, status_message="This enrichment method is not implemented!", values=None)

    def loomUploaded(self, request, content):
        uploadedLooms[request.UUID].add(request.filename)
        return s_pb2.LoomUploadedReply()


def serve(run_event, devEnv=False, port=50052, appMode=False):
    SCope.devEnv = devEnv
    SCope.appMode = appMode
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    s_pb2_grpc.add_MainServicer_to_server(SCope(), server)
    server.add_insecure_port('[::]:{0}'.format(port))
    # print('Starting GServer on port {0}...'.format(port))
    server.start()
    # Let the main process know that GServer has started.

    su.send_msg("GServer", "SIGSTART")

    while run_event.is_set():
        time.sleep(0.1)

    # Write UUIDs to file here
    SCope.uuid_log.close()
    SCope.updateUUIDdb(SCope())
    server.stop(0)


if __name__ == '__main__':
    run_event = threading.Event()
    run_event.set()
    serve(run_event=run_event)
