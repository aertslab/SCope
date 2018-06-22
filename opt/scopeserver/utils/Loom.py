import numpy as np
import json
import zlib
import base64
from functools import lru_cache
import pandas as pd
import time

from scopeserver.utils import DataFileHandler as dfh

class Loom():

    def __init__(self, partial_md5_hash, file_path, abs_file_path, loom_connection):
        self.partial_md5_hash = partial_md5_hash
        self.file_path = file_path
        self.abs_file_path = abs_file_path
        self.loom_connection = loom_connection
        print("New .loom created.")
        # Metrics
        self.nUMI = None

    def get_connection(self):
        return self.loom_connection

    def get_file_path(self):
        return self.file_path

    def get_abs_file_path(self):
        return self.abs_file_path

    def get_global_attribute_by_name(self, name):
        if name not in self.loom_connection.attrs.keys():
            raise AttributeError("The global attribute {0} does not exist in the .loom file.".format(name))
        return self.loom_connection.attrs[name]

    @staticmethod
    def dfToNamedMatrix(df):
        arr_ip = [tuple(i) for i in df.as_matrix()]
        dtyp = np.dtype(list(zip(df.dtypes.index, df.dtypes)))
        arr = np.array(arr_ip, dtype=dtyp)
        return arr

    def get_cell_ids(self):
        return self.loom_connection.ca["CellID"]

    #############
    # Meta Data #
    #############

    @staticmethod
    def decompress_meta(meta):
        try:
            meta = meta.decode('ascii')
            return json.loads(zlib.decompress(base64.b64decode(meta)))
        except AttributeError:
            return json.loads(zlib.decompress(base64.b64decode(meta.encode('ascii'))).decode('ascii'))

    def generate_meta_data(self):
        loom = self.loom_connection
        # Designed to generate metadata from linnarson loom files
        print('Making metadata for {0}'.format(self.get_abs_file_path()))
        metaJson = {}

        # self.change_loom_mode(loom_file_path, rw=True)

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
            loom.ca['Clusterings'] = Loom.dfToNamedMatrix(clusterDF)
            print(loom.ca["Clusterings"])
        metaJson["clusterings"].append({
                    "id": 0,
                    "group": "Interpreted",
                    "name": "Clusters + ClusterName",
                    "clusters": clusters
                })
        print(metaJson)

        loom.attrs['MetaData'] = base64.b64encode(zlib.compress(json.dumps(metaJson).encode('ascii'))).decode('ascii')
        # self.change_loom_mode(loom_file_path, rw=False)

    def get_file_metadata(self):
        """Summarize in a dict what feature data the loom file contains.

        Returns:
            dict: A dictionary defining whether the current implemented features in SCope are available for the loom file with the given loom_file_path.

        """
        loom = self.loom_connection
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

    def get_meta_data_annotation_by_name(self, name):
        md_annotations = self.get_meta_data_by_key(key="annotations")
        md_annotation = list(filter(lambda x: x["name"] == name, md_annotations))
        if(len(md_annotation) > 1):
            raise ValueError('Multiple annotations matches the given name '+name)
        return md_annotation[0]

    def get_meta_data_clustering_by_id(self, id):
        md_clusterings = self.get_meta_data_by_key(key="clusterings")
        md_clustering = list(filter(lambda x: x["id"] == id, md_clusterings))
        if(len(md_clustering) > 1):
            raise ValueError('Multiple clusterings matches the given id '+id)
        return md_clustering[0]

    def get_meta_data_by_key(self, key):
        meta_data = self.get_meta_data()
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

    def has_md_annotations(self):
        if self.has_meta_data():
            return self.has_md_annotations_(meta_data=self.get_meta_data())
        return False

    @staticmethod
    def has_md_clusterings_(meta_data):
        return "clusterings" in meta_data

    def has_md_clusterings(self):
        if self.has_meta_data():
            return self.has_md_clusterings_(meta_data=self.get_meta_data())
        return False

    def has_meta_data(self):
        return "MetaData" in self.loom_connection.attrs.keys()

    def get_meta_data(self):
        md = self.loom_connection.attrs.MetaData
        if type(md) is np.ndarray:
            md = self.loom_connection.attrs.MetaData[0]
        try:
            return json.loads(md)
        except json.decoder.JSONDecodeError:
            return Loom.decompress_meta(meta=md)

    def get_nb_cells(self):
        return self.loom_connection.shape[1]

    def get_genes(self):
        return self.loom_connection.ra.Gene.astype(str)

    @lru_cache(maxsize=32)
    def infer_species(self):
        genes = set(self.get_genes())
        maxPerc = 0.0
        maxSpecies = ''
        mappings = {
            'dmel': dfh.DataFileHandler.dmel_mappings
        }
        for species in mappings.keys():
            intersect = genes.intersection(mappings[species].keys())
            if (len(intersect) / len(genes)) > maxPerc:
                maxPerc = (len(intersect) / len(genes))
                maxSpecies = species
        if maxPerc < 0.5:
            return 'Unknown', {}
        return maxSpecies, mappings[maxSpecies]

    def get_anno_cells(self, annotations, logic='OR'):
        loom = self.loom_connection
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

    @lru_cache(maxsize=8)
    def get_gene_names(self):
        genes = self.get_genes()
        conversion = {}
        species, geneMappings = self.infer_species()
        for gene in genes:
            gene = str(gene)
            try:
                if geneMappings[gene] != gene:
                    conversion[geneMappings[gene]] = gene
            except KeyError:
                print("ERROR: Gene: {0} is not in the mapping table!".format(gene))
        return conversion

    ##############
    # Expression #
    ##############

    def get_nUMI(self):
        if self.nUMI is not None:
            return self.nUMI
        if self.has_ca_attr(name="nUMI"):
            return self.loom_connection.ca.nUMI
        # Compute nUMI on the fly
        calc_nUMI_start_time = time.time()
        self.nUMI = self.loom_connection[:,:].sum(axis=0)
        print("Debug: %s seconds elapsed (calculating nUMI) ---" % (time.time() - calc_nUMI_start_time))
        return self.nUMI

    def get_gene_expression_by_gene_symbol(self, gene_symbol):
        return self.loom_connection[self.get_genes() == gene_symbol, :][0]

    def get_gene_expression(self, gene_symbol, log_transform=True, cpm_normalise=False, annotation='', logic='OR'):
        if gene_symbol not in set(self.get_genes()):
            gene_symbol = self.get_gene_names()[gene_symbol]
        print("Debug: getting expression of " + gene_symbol + "...")
        gene_expr = self.get_gene_expression_by_gene_symbol(gene_symbol=gene_symbol)
        if cpm_normalise:
            print("Debug: CPM normalising gene expression...")
            gene_expr = gene_expr / self.get_nUMI()
        if log_transform:
            print("Debug: log-transforming gene expression...")
            gene_expr = np.log2(gene_expr + 1)
        if len(annotation) > 0:
            cellIndices = self.get_anno_cells(annotations=annotation, logic=logic)
            gene_expr = gene_expr[cellIndices]
        else:
            cellIndices = list(range(self.get_nb_cells()))
        return gene_expr, cellIndices

    ############
    # Regulons #
    ############

    def get_regulon_genes(self, regulon):
        return self.get_genes()[self.loom_connection.ra.Regulons[regulon] == 1]

    def has_regulons_AUC(self):
        return "RegulonsAUC" in self.loom_connection.ca.keys()

    def get_regulons_AUC(self):
        loom = self.loom_connection
        L = loom.ca.RegulonsAUC.dtype.names
        loom.ca.RegulonsAUC.dtype.names = list(map(lambda s: s.replace(' ', '_'), L))
        return loom.ca.RegulonsAUC

    def get_auc_values(self, regulon, annotation='', logic='OR'):
        print("Debug: getting AUC values for {0} ...".format(regulon))
        cellIndices = list(range(self.get_nb_cells()))
        if regulon in self.get_regulons_AUC().dtype.names:
            vals = self.get_regulons_AUC()[regulon]
            if len(annotation) > 0:
                cellIndices = self.get_anno_cells(annotations=annotation, logic=logic)
                vals = vals[cellIndices]
            return vals, cellIndices
        return [], cellIndices

    ##############
    # Embeddings #
    ##############

    def get_coordinates(self, coordinatesID=-1, annotation='', logic='OR'):
        loom = self.loom_connection
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
            cellIndices = self.get_anno_cells(annotations=annotation, logic=logic)
            x = x[cellIndices]
            y = y[cellIndices]
        else:
            cellIndices = list(range(self.get_nb_cells()))
        return {"x": x,
                "y": -y,
                "cellIndices": cellIndices}

    ##############
    # Annotation #
    ##############

    def has_ca_attr(self, name):
        return name in self.loom_connection.ca.keys()

    def get_ca_attr_by_name(self, name):
        if self.has_ca_attr(name=name):
            return self.loom_connection.ca[name]
        raise ValueError("The given annotation {0} does not exists in the .loom.".format(name))


    ###############
    # Clusterings #
    ###############

    def get_clustering_by_id(self, clustering_id):
        return self.loom_connection.ca.Clusterings[str(clustering_id)]

    # def get_cluster_IDs(self, loom_file_path, clustering_id):
    #     loom = self.lfh.get_loom_connection(loom_file_path)
    #     return loom.ca.Clusterings[str(clustering_id)]

    def get_cluster_marker_genes(self, clustering_id, cluster_id):
        return self.get_genes()[self.loom_connection.ra["ClusterMarkers_{0}".format(clustering_id)][str(cluster_id)] == 1]

    def get_cluster_marker_metrics(self, clustering_id, cluster_id, metric_accessor):
        cluster_marker_metric = self.loom_connection.row_attrs["ClusterMarkers_{0}_{1}".format(clustering_id, metric_accessor)][str(cluster_id)]
        # Return non-zero values
        return cluster_marker_metric[cluster_marker_metric != 0]
