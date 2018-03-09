from concurrent import futures
import time
import grpc
from scopeserver.modules.gserver import s_pb2
from scopeserver.modules.gserver import s_pb2_grpc

import loompy as lp
import hashlib
import os
import numpy as np
import json
import zlib
import base64
import pickle
from collections import OrderedDict
from functools import lru_cache
from itertools import compress
from pathlib import Path

_ONE_DAY_IN_SECONDS = 60 * 60 * 24
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

dataDir = os.path.join(Path(__file__).resolve().parents[3], 'data', 'gene_mappings')
dmel_mappings = pickle.load(open(os.path.join(dataDir, 'terminal_mappings.pickle'), 'rb'))


class SCope(s_pb2_grpc.MainServicer):

    def __init__(self):
        self.active_loom_connections = {}
        self.loom_dir = os.path.join("data", "my-looms")

    @staticmethod
    def get_partial_md5_hash(file_path, last_n_kb):
        with open(file_path, 'rb') as f:
            f.seek(- last_n_kb * 1024, 2)
            return hashlib.md5(f.read()).hexdigest()

    def add_loom_connection(self, partial_md5_hash, loom):
        self.active_loom_connections[partial_md5_hash] = loom

    def get_loom_filepath(self, loom_file_name):
        return os.path.join(self.loom_dir, loom_file_name)

    def load_loom_file(self, partial_md5_hash, loom_file_path):
        loom = lp.connect(loom_file_path)
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

    def decompress_meta(self, meta):
        return json.loads(zlib.decompress(base64.b64decode(meta.encode('ascii'))).decode('ascii'))

    @lru_cache(maxsize=32)
    def infer_species(self, loom_file_path):
        loom = self.get_loom_connection(loom_file_path)
        genes = set(loom.ra.Gene)
        maxPerc = 0.0
        maxSpecies = ''
        mappings = {
            'dmel': dmel_mappings
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

    def get_gene_expression(self, loom_file_path, gene_symbol, log_transform=True, cpm_normalise=False, annotation=''):
        loom = self.get_loom_connection(loom_file_path)
        if gene_symbol not in set(loom.ra.Gene):
            gene_symbol = self.get_gene_names(loom_file_path)[gene_symbol]
        print("Debug: getting expression of " + gene_symbol + "...")
        gene_expr = loom[loom.ra.Gene == gene_symbol, :][0]
        if log_transform:
            print("Debug: log-transforming gene expression...")
            gene_expr = np.log2(gene_expr + 1)
        if cpm_normalise:
            print("Debug: CPM normalising gene expression...")
            gene_expr = gene_expr / loom.ca.nUMI
            gene_expr = gene_expr
        if len(annotation) > 0:
            cellIndices = self.get_anno_cells(loom_file_path=loom_file_path, annotations=annotation)
            gene_expr = gene_expr[cellIndices]
        return gene_expr

    def get_auc_values(self, loom_file_path, regulon, annotation=''):
        loom = self.get_loom_connection(loom_file_path)
        print("Debug: getting AUC values for {0} ...".format(regulon))
        if regulon in loom.ca.RegulonsAUC.dtype.names:
            vals = loom.ca.RegulonsAUC[regulon]
            if len(annotation) > 0:
                cellIndices = self.get_anno_cells(loom_file_path=loom_file_path, annotations=annotation)
                vals = vals[cellIndices]
            return vals
        return []

    def get_clusterIDs(self, loom_file_path, clusterID):
        loom = self.get_loom_connection(loom_file_path)
        return loom.ca.Clusterings[str(clusterID)]

    def get_annotation(self, loom_file_path, annoName):
        loom = self.get_loom_connection(loom_file_path)
        return loom.ca[annoName]

    @lru_cache(maxsize=8)
    def get_gene_names(self, loom_file_path):
        loom = self.get_loom_connection(loom_file_path)
        genes = loom.ra.Gene
        conversion = {}
        species, geneMappings = self.infer_species(loom_file_path)
        for gene in genes:
            gene = str(gene)
            if geneMappings[gene] != gene:
                conversion[geneMappings[gene]] = gene
        return conversion

    @lru_cache(maxsize=8)
    def build_searchspace(self, loom_file_path):
        start_time = time.time()
        species, geneMappings = self.infer_species(loom_file_path)
        loom = self.get_loom_connection(loom_file_path)
        meta = True
        try:
            metaData = json.loads(loom.attrs.MetaData)
        except ValueError:
            metaData = self.decompress_meta(loom.attrs.MetaData)
        except AttributeError:
            meta = False

        def add_element(searchSpace, elements, elementName):
            if type(elements) != str:
                for element in elements:
                    if elementName == 'gene':
                        if len(geneMappings) > 0:
                            if geneMappings[element] != element:
                                searchSpace[('{0}'.format(str(element)).casefold(), element, elementName)] = geneMappings[element]
                            else:
                                searchSpace[(element.casefold(), element, elementName)] = element
                        else:
                            searchSpace[(element.casefold(), element, elementName)] = element
            else:
                searchSpace[(elements.casefold(), elements, elementName)] = elements
            return searchSpace

        searchSpace = {}
        if len(geneMappings) > 0:
            genes = set(loom.ra.Gene)
            shrinkMappings = set([x for x in dmel_mappings.keys() if x in genes or dmel_mappings[x] in genes])
            # searchSpace = add_element(searchSpace, dmel_mappings.keys(), 'gene')
            searchSpace = add_element(searchSpace, shrinkMappings, 'gene')
        else:
            searchSpace = add_element(searchSpace, loom.ra.Gene, 'gene')

        try:
            searchSpace = add_element(searchSpace, loom.ra.Regulons.dtype.names, 'regulon')
        except AttributeError:
            pass  # No regulons in file

        if meta:
            for clustering in metaData['clusterings']:
                allClusters = ['All Clusters']
                for cluster in clustering['clusters']:
                    allClusters.append(cluster['description'])
                searchSpace = add_element(searchSpace, allClusters, 'Clustering: {0}'.format(clustering['name']))

        print("Debug: %s seconds elapsed making search space ---" % (time.time() - start_time))
        return searchSpace

    @lru_cache(maxsize=256)
    def get_features(self, loom_file_path, query):
        searchSpace = self.build_searchspace(loom_file_path)
        # Filter the genes by the query

        # Allow caps innsensitive searching, minor slowdown
        start_time = time.time()
        res = []

        queryCF = query.casefold()
        res = [x for x in searchSpace.keys() if queryCF in x[0]]

        for n, r in enumerate(res):
            if r[0].startswith(queryCF) or query in r[0]:
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
        collapsedResults = OrderedDict()
        for r in res:
            if searchSpace[r] not in collapsedResults.keys():
                collapsedResults[searchSpace[r]] = [(r[1], r[2])]
            else:
                collapsedResults[searchSpace[r]].append((r[1], r[2]))

        descriptions = []
        for r in collapsedResults.keys():
            synonyms = sorted([x[0] for x in collapsedResults[r]])
            try:
                synonyms.remove(r)
            except ValueError:
                pass
            if len(synonyms) > 0:
                descriptions.append('Synonym of: {0}'.format(', '.join(synonyms)))
            else:
                descriptions.append('')
        # if mapping[result] != result: change title and description to indicate synonym

        print("Debug: " + str(len(res)) + " genes matching '" + query + "'")
        print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        res = {'feature': [r for r in collapsedResults.keys()],
               'featureType': [collapsedResults[r][0][1] for r in collapsedResults.keys()],
               'featureDescription': descriptions}
        print(query, len(res['feature']))
        return res

    def get_anno_cells(self, loom_file_path, annotations):
        loom = self.get_loom_connection(loom_file_path)
        cellIndices = set()
        for anno in annotations:
            annoName = anno.name
            if annoName.startswith("Clustering_"):
                clusteringID = str(annoName.split('_')[1])
                for annotationValue in anno.values:
                    [cellIndices.add(x) for x in np.where(loom.ca.Clusterings[clusteringID] == annotationValue)[0]]
            else:
                for annotationValue in anno.values:
                    [cellIndices.add(x) for x in np.where(loom.ca[annoName] == annotationValue)[0]]
        return sorted(list(cellIndices))

    def get_coordinates(self, loom_file_path, coordinatesID=-1, annotation=''):
        loom = self.get_loom_connection(loom_file_path)
        dims = 0
        if coordinatesID == -1:
            try:
                embedding = loom.ca['Embedding']
                x = embedding['_X']
                y = embedding['_Y']
            except AttributeError:
                for ca in loom.ca:
                    if 'tSNE'.casefold() in ca.casefold():
                        if dims == 0:
                            x = loom.ca[ca]
                            dims += 1
                            continue
                        if dims == 1:
                            y = loom.ca[ca]
                            dims += 1
                            continue
        else:
            x = loom.ca.Embeddings_X[str(coordinatesID)]
            y = loom.ca.Embeddings_Y[str(coordinatesID)]
        if len(annotation) > 0:
            cellIndices = self.get_anno_cells(loom_file_path=loom_file_path, annotations=annotation)
            x = x[cellIndices]
            y = y[cellIndices]
        return {"x": x,
                "y": y}

    def get_file_metadata(self, loom_file_path):
        loom = self.get_loom_connection(loom_file_path)
        meta = {}
        if hasattr(loom.ca, "RegulonsAUC"):
            meta['hasRegulonsAUC'] = True
        else:
            meta['hasRegulonsAUC'] = False
        if hasattr(loom.ca, "Clusterings"):
            meta['hasClusterings'] = True
        else:
            meta['hasClusterings'] = False
        if hasattr(loom.ca, "Embeddings_X"):
            meta['hasExtraEmbeddings'] = True
        else:
            meta['hasExtraEmbeddings'] = False
        if hasattr(loom.ra, "GeneSets"):
            meta['hasGeneSets'] = True
        else:
            meta['hasGeneSets'] = False
        try:
            try:
                metaData = json.loads(loom.attrs.MetaData)
            except ValueError:
                metaData = self.decompress_meta(loom.attrs.MetaData)
            meta['hasGlobalMeta'] = True
        except (KeyError, AttributeError):
            meta['hasGlobalMeta'] = False
        return meta

    def compressHexColor(self, a):
        a = int(a, 16)
        a_hex3d = hex(a >> 20 << 8 | a >> 8 & 240 | a >> 4 & 15)
        return a_hex3d.replace("0x", "")

    def getVmax(self, vals):
        vmax = np.percentile(vals, 99)
        if vmax == 0 and max(vals) != 0:
            vmax = max(vals)
        if vmax < 10:
            vmax = max(vals)
        return vmax

    def getCellColorByFeatures(self, request, context):
        print(request)
        start_time = time.time()
        loomFilePath = self.get_loom_filepath(request.loomFilePath)
        loom = self.get_loom_connection(loomFilePath)
        try:
            metaData = json.loads(loom.attrs.MetaData)
        except ValueError:
            metaData = self.decompress_meta(loom.attrs.MetaData)
        except AttributeError:
            pass
        if not os.path.isfile(loomFilePath):
            return
        n_cells = self.get_nb_cells(loomFilePath)
        features = []
        hex_vec = []
        vmax = np.zeros(3)
        for n, feature in enumerate(request.feature):
            if request.featureType[n] == 'gene':
                if feature != '':
                    vals = self.get_gene_expression(
                        loom_file_path=loomFilePath,
                        gene_symbol=feature,
                        log_transform=request.hasLogTranform,
                        cpm_normalise=request.hasCpmTranform,
                        annotation=request.annotation)
                    if request.vmax[n] != 0.0:
                        vmax[n] = request.vmax[n]
                    else:
                        vmax[n] = self.getVmax(vals)
                    vals = np.round((vals / vmax[n]) * 255)
                    features.append([x if x <= 255 else 255 for x in vals])
                else:
                    features.append(np.zeros(n_cells))
            elif request.featureType[n] == 'regulon':
                if feature != '':
                    vals = self.get_auc_values(loom_file_path=loomFilePath,
                                               regulon=feature,
                                               annotation=request.annotation)
                    if request.vmax[n] != 0.0:
                        vmax[n] = request.vmax[n]
                    else:
                        vmax[n] = self.getVmax(vals)
                    if request.scaleThresholded:
                        vals = ([auc if auc >= request.threshold[n] else 0 for auc in vals])
                        vals = np.round((vals / vmax[n]) * 255)
                        features.append([x if x <= 255 else 255 for x in vals])
                    else:
                        features.append([225 if auc >= request.threshold[n] else 0 for auc in vals])
                else:
                    features.append(np.zeros(n_cells))
            elif request.featureType[n].startswith('Clustering: '):
                for clustering in metaData['clusterings']:
                    if clustering['name'] == request.featureType[n].lstrip('Clustering: '):
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
                                cellIndices = self.get_anno_cells(loom_file_path=loomFilePath, annotations=request.annotation)
                                hex_vec = np.array(hex_vec)[cellIndices]
                            return s_pb2.CellColorByFeaturesReply(color=hex_vec, vmax=vmax)
                        else:
                            for cluster in clustering['clusters']:
                                if request.feature[n] == cluster['description']:
                                    clusterID = int(cluster['id'])
                clusterIndices = loom.ca.Clusterings[clusteringID] == clusterID
                clusterCol = np.array([225 if x else 0 for x in clusterIndices])
                if len(request.annotation) > 0:
                    cellIndices = self.get_anno_cells(loom_file_path=loomFilePath, annotations=request.annotation)
                    clusterCol = clusterCol[cellIndices]
                features.append(clusterCol)
            else:
                features.append(np.zeros(n_cells))
        if len(features) > 0 and len(hex_vec) == 0:
            hex_vec = ["%02x%02x%02x" % (int(r), int(g), int(b)) for r, g, b in zip(features[0], features[1], features[2])]

        print("Debug: %s seconds elapsed ---" % (time.time() - start_time))
        return s_pb2.CellColorByFeaturesReply(color=hex_vec, vmax=vmax)

    def getCellAUCValuesByFeatures(self, request, context):
        loomFilePath = self.get_loom_filepath(request.loomFilePath)
        return s_pb2.CellAUCValuesByFeaturesReply(value=self.get_auc_values(loom_file_path=loomFilePath, regulon=request.feature[0]))

    def getCellMetaData(self, request, context):
        loomFilePath = self.get_loom_filepath(request.loomFilePath)
        if len(request.cellIndices) == 0:
            request.cellIndices = list(range(self.get_nb_cells(loomFilePath)))

        cellClusters = []
        for cluster in request.clusterings:
            if cluster != '':
                cellClusters.append(self.get_clusterIDs(loom_file_path=loomFilePath,
                                                        clusterID=cluster)[request.cellIndices])
        geneExp = []
        for gene in request.selectedGenes:
            if gene != '':
                geneExp.append(self.get_gene_expression(loom_file_path=loomFilePath,
                                                        gene_symbol=gene,
                                                        log_transform=request.hasLogTranform,
                                                        cpm_normalise=request.hasCpmTranform)[request.cellIndices])
        aucVals = []
        for regulon in request.selectedRegulons:
            if regulon != '':
                aucVals.append(self.get_auc_values(loom_file_path=loomFilePath,
                                                   regulon=regulon)[request.cellIndices])
        annotations = []
        for anno in request.annotations:
            if anno != '':
                annotations.append(self.get_annotation(loom_file_path=loomFilePath,
                                                       annoName=anno)[request.cellIndices])

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
                                 annotation=request.annotation)
        return s_pb2.CoordinatesReply(x=c["x"], y=c["y"])

    def getRegulonMetaData(self, request, context):
        loom = self.get_loom_connection(self.get_loom_filepath(request.loomFilePath))
        regulonGenes = loom.ra.Gene[loom.ra.Regulons[request.regulon] == 1]
        try:
            metaData = json.loads(loom.attrs.MetaData)
        except ValueError:
            metaData = self.decompress_meta(loom.attrs.MetaData)
        for regulon in metaData['regulonThresholds']:
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
        genes = loom.ra.Gene[loom.ra["ClusterMarkers_{0}".format(request.clusteringID)][request.clusterID] == 1]
        return(s_pb2.MarkerGenesReply(genes=genes))

    def getMyLooms(self, request, context):
        my_looms = []
        for f in os.listdir(self.loom_dir):
            if f.endswith('.loom'):
                loom = self.get_loom_connection(self.get_loom_filepath(f))
                fileMeta = self.get_file_metadata(self.get_loom_filepath(f))
                if fileMeta['hasGlobalMeta']:
                    try:
                        meta = json.loads(loom.attrs.MetaData)
                    except ValueError:
                        meta = self.decompress_meta(loom.attrs.MetaData)
                    annotations = meta['annotations']
                    embeddings = meta['embeddings']
                    clusterings = meta['clusterings']
                else:
                    annotations = []
                    embeddings = []
                    clusterings = []
                my_looms.append(s_pb2.MyLoom(loomFilePath=f,
                                             cellMetaData=s_pb2.CellMetaData(annotations=annotations,
                                                                             embeddings=embeddings,
                                                                             clusterings=clusterings),
                                             fileMetaData=fileMeta))
        return s_pb2.MyLoomsReply(myLooms=my_looms)

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

def serve(run_event, port=50052):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    s_pb2_grpc.add_MainServicer_to_server(SCope(), server)
    server.add_insecure_port('[::]:{0}'.format(port))
    print('Starting GServer on port {0}...'.format(port))

    server.start()

    while run_event.is_set():
        time.sleep(0.1)

    server.stop(0)


if __name__ == '__main__':
    serve()
