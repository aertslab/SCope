import numpy as np
import json
import zlib
import base64
from functools import lru_cache
import pandas as pd
import time
import loompy as lp

from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils import search_space as ss

import logging

logger = logging.getLogger(__name__)


class Loom():

    def __init__(self, partial_md5_hash, file_path, abs_file_path, loom_connection, loom_file_handler):
        self.lfh = loom_file_handler
        self.partial_md5_hash = partial_md5_hash
        self.file_path = file_path
        self.abs_file_path = abs_file_path
        self.loom_connection = loom_connection
        logger.info(f"New Loom object created for {file_path}")
        # Metrics
        self.nUMI = None
        self.species, self.gene_mappings = self.infer_species()

        logger.debug(f'Building Search Spaces for {file_path}')
        if self.species == 'dmel':
            logger.debug(f'Building hsap Search Spaces for {file_path}')
            self.hsap_ss = ss.SearchSpace(loom=self, cross_species='hsap').build()
            logger.debug(f'Building mmus Search Spaces for {file_path}')

            self.mmus_ss = ss.SearchSpace(loom=self, cross_species='mmus').build()
        logger.debug(f'Building self Search Spaces for {file_path}')

        self.ss = ss.SearchSpace(loom=self).build()
        logger.debug(f'Built all Search Spaces for {file_path}')

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
    def clean_file_attr(file_attr):
        fa = file_attr
        if type(file_attr) == np.ndarray:
            fa = file_attr[0]
        try:
            fa = fa.decode("utf-8")
        except AttributeError:
            pass
        return fa

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

    def rename_annotation(self, clustering_id, cluster_id, new_annotation_name):
        logger.info('Changing annotation name for {0}'.format(self.get_abs_file_path()))

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode='r+', partial_md5_hash=self.partial_md5_hash)
        loom = self.loom_connection
        metaJson = self.get_meta_data()        

        for n, clustering in enumerate(metaJson['clusterings']):
            if clustering['id'] == clustering_id:
                clustering_n = n

        for n, cluster in enumerate(metaJson['clusterings'][clustering_n]['clusters']):
            if cluster['id'] == cluster_id:
                cluster_n = n

        metaJson['clusterings'][clustering_n]['clusters'][cluster_n]['description'] = new_annotation_name

        loom.attrs['MetaData'] = json.dumps(metaJson)  # base64.b64encode(zlib.compress(json.dumps(metaJson).encode('ascii'))).decode('ascii')

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode='r', partial_md5_hash=self.partial_md5_hash)

        loom = self.loom_connection

        if self.get_meta_data()['clusterings'][clustering_n]['clusters'][cluster_n]['description'] == new_annotation_name:
            logger.debug('Success')
            return True
        else:
            logger.debug('Failure')
            return False

    def set_hierarchy(self, L1, L2, L3):
        logger.info('Changing hierarchy name for {0}'.format(self.get_abs_file_path()))

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode='r+', partial_md5_hash=self.partial_md5_hash)
        loom = self.loom_connection
        attrs = self.loom_connection.attrs

        attrs['SCopeTreeL1'] = L1
        attrs['SCopeTreeL2'] = L2
        attrs['SCopeTreeL3'] = L3

        loom.attrs = attrs # base64.b64encode(zlib.compress(json.dumps(metaJson).encode('ascii'))).decode('ascii')

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode='r', partial_md5_hash=self.partial_md5_hash)

        loom = self.loom_connection

        newAttrs = self.loom_connection.attrs

        if newAttrs['SCopeTreeL1'] == L1 and newAttrs['SCopeTreeL2'] == L2 and newAttrs['SCopeTreeL3'] == L3:
            logger.debug('Success')
            return True
        else:
            logger.debug('Failure')
            return False

    def generate_meta_data(self):
        # Designed to generate metadata from linnarson loom files
        logger.info('Making metadata for {0}'.format(self.get_abs_file_path()))
        metaJson = {}

        def dfToNamedMatrix(df):
            arr_ip = [tuple(i) for i in df.as_matrix()]
            dtyp = np.dtype(list(zip(df.dtypes.index, df.dtypes)))
            arr = np.array(arr_ip, dtype=dtyp)
            return arr

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode='r+')
        loom = self.loom_connection
        col_attrs = loom.ca.keys()

        # Embeddings
        # Find PCA / tSNE - Catch all 0's ERROR

        embeddings_id = 1
        embeddings_default = False
        if ('_tSNE1' in col_attrs and '_tSNE2' in col_attrs) or ('_X' in col_attrs and '_Y' in col_attrs):
            metaJson['embeddings'] = [
                {
                    "id": -1,
                    "name": "Default (_tSNE1/_tSNE2 or _X/_Y)"
                }
            ]
            embeddings_default = True
        else:
            metaJson['embeddings'] = []

        Embeddings_X = pd.DataFrame()
        Embeddings_Y = pd.DataFrame()

        for col in col_attrs:
            cf_col = col.casefold()
            if ('tsne'.casefold() in cf_col or 'umap'.casefold() in cf_col or 'pca'.casefold() in cf_col) and loom.ca[col].shape[1] >= 2:
                if not embeddings_default:
                    metaJson['embeddings'].append({
                        "id": -1,
                        "name": col
                    })
                    loom.ca['Embedding'] = dfToNamedMatrix(pd.DataFrame(loom.ca[col][:, :2], columns=['_X', '_Y']))
                    embeddings_default = True
                else:
                    metaJson['embeddings'].append({
                        "id": embeddings_id,
                        "name": col
                    })
                    Embeddings_X[str(embeddings_id)] = loom.ca[col][:, 0]
                    Embeddings_Y[str(embeddings_id)] = loom.ca[col][:, 1]
                    embeddings_id += 1
        if Embeddings_X.shape != (0, 0):
            loom.ca['Embeddings_X'] = dfToNamedMatrix(Embeddings_X)
            loom.ca['Embeddings_Y'] = dfToNamedMatrix(Embeddings_Y)

        # Annotations - What goes here?
        metaJson["annotations"] = []
        for anno in ['Age', 'ClusterName', 'Sex', 'Species', 'Strain', 'Tissue']:
            if anno in loom.ca.keys():
                logger.info("\tAnnotation: {0} in loom".format(anno))
                if len(set(loom.ca[anno])) != loom.shape[1] and len(set(loom.ca[anno])) > 0:
                    metaJson["annotations"].append({"name": anno, "values": sorted(list(set(loom.ca[anno])))})
                    logger.debug(f'\t\tValues: {sorted(list(set(loom.ca[anno])))}')

        logger.debug(f'\tFinal Annotations for {self.file_path} - {metaJson["annotations"]}')

        # Clusterings - Anything with cluster in name?
        metaJson["clusterings"] = []
        if 'Clusters' in loom.ca.keys() and 'ClusterName' in loom.ca.keys():
            logger.debug(f'\tDetected clusterings in loom file. Adding metadata.')
            clusters = set(zip(loom.ca['Clusters'], loom.ca['ClusterName']))
            clusters = [{"id": int(x[0]), "description": x[1]} for x in clusters]

            # loom.ca['Clusterings'] = SCope.dfToNamedMatrix(pd.DataFrame(columns=[0], index=[x for x in range(loom.shape[1])], data=[int(x) for x in loom.ca['Clusters']]))

            clusterDF = pd.DataFrame(columns=["0"], index=[x for x in range(loom.shape[1])])
            clusterDF["0"] = [int(x) for x in loom.ca['Clusters']]
            loom.ca['Clusterings'] = Loom.dfToNamedMatrix(clusterDF)
            metaJson["clusterings"].append({"id": 0,
                                            "group": "Interpreted",
                                            "name": "Clusters + ClusterName",
                                            "clusters": clusters
                                            })
        logger.debug(f'\tFinal Clusterings for {self.file_path} - {metaJson["clusterings"]}')

        loom.attrs['MetaData'] = json.dumps(metaJson)  # base64.b64encode(zlib.compress(json.dumps(metaJson).encode('ascii'))).decode('ascii')
        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode='r')

    def get_file_metadata(self):
        """Summarize in a dict what feature data the loom file contains.

        Returns:
            dict: A dictionary defining whether the current implemented features in SCope are available for the loom file with the given loom_file_path.

        """
        loom = self.loom_connection
        attr_margins = [2, 2, 2, 2, 0]
        attr_names = ["RegulonsAUC", "Clusterings", "Embeddings_X", "GeneSets", "MetaData"]
        attr_keys = ["RegulonsAUC", "Clusterings", "ExtraEmbeddings", "GeneSets", "GlobalMeta"]

        def loom_attr_exists(x):
            tmp = {}
            idx = attr_names.index(x)
            margin = attr_margins[idx]
            ha = False
            if margin == 0 and x in loom.attrs.keys():
                ha = True
            elif margin == 1 and x in loom.ra.keys():
                ha = True
            elif margin == 2 and x in loom.ca.keys():
                ha = True
            tmp["has{0}".format(attr_keys[idx])] = ha
            return tmp

        md = map(loom_attr_exists, attr_names)
        meta = {k: v for d in md for k, v in d.items()}
        return meta

    def get_meta_data_annotation_by_name(self, name):
        md_annotations = self.get_meta_data_by_key(key="annotations")
        md_annotation = list(filter(lambda x: x["name"] == name, md_annotations))
        if(len(md_annotation) > 1):
            raise ValueError('Multiple annotations matches the given name: {0}'.format(name))
        return md_annotation[0]

    def get_meta_data_cluster_by_clustering_id_and_cluster_id(self, clustering_id, cluster_id):
        md_clustering = self.get_meta_data_clustering_by_id(clustering_id)
        md_cluster = list(filter(lambda x: x["id"] == cluster_id, md_clustering["clusters"]))
        if(len(md_cluster) == 0):
            raise ValueError('The cluster with the given id {0} does not exist.'.format(cluster_id))
        if(len(md_cluster) > 1):
            raise ValueError('Multiple clusters matches the given id: {0}'.format(cluster_id))
        return md_cluster[0]

    def get_meta_data_clustering_by_id(self, id):
        md_clusterings = self.get_meta_data_by_key(key="clusterings")
        md_clustering = list(filter(lambda x: x["id"] == id, md_clusterings))
        if(len(md_clustering) > 1):
            raise ValueError('Multiple clusterings matches the given id: {0}'.format(id))
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
    def has_md_metrics_(meta_data):
        return "metrics" in meta_data

    def has_md_metrics(self):
        if self.has_meta_data():
            return self.has_md_metrics_(meta_data=self.get_meta_data())
        return False

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

    @lru_cache(maxsize=1)
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
        cell_indices = []
        for anno in annotations:
            anno_name = anno.name
            for annotation_value in anno.values:
                anno_set = set()
                if anno_name.startswith("Clustering_"):
                    clustering_id = str(anno_name.split('_')[1])
                    [anno_set.add(x) for x in np.where(loom.ca.Clusterings[clustering_id] == annotation_value)[0]]
                else:
                    [anno_set.add(x) for x in np.where(loom.ca[anno_name].astype(str) == str(annotation_value))[0]]
                cell_indices.append(anno_set)
        if logic not in ['AND', 'OR']:
            logic = 'OR'
        if logic == 'AND':
            return sorted(list(set.intersection(*cell_indices)))
        elif logic == 'OR':
            return sorted(list(set.union(*cell_indices)))

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
                logger.error("Gene: {0} is not in the mapping table!".format(gene))
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
        self.nUMI = self.loom_connection[:, :].sum(axis=0)
        logger.debug("{0:.5f} seconds elapsed (calculating nUMI) ---".format(time.time() - calc_nUMI_start_time))
        return self.nUMI

    def get_gene_expression_by_gene_symbol(self, gene_symbol):
        return self.loom_connection[self.get_genes() == gene_symbol, :][0]

    def get_gene_expression(self, gene_symbol, log_transform=True, cpm_normalise=False, annotation='', logic='OR'):
        if gene_symbol not in set(self.get_genes()):
            gene_symbol = self.get_gene_names()[gene_symbol]
        logger.debug("Debug: getting expression of {0} ...".format(gene_symbol))
        gene_expr = self.get_gene_expression_by_gene_symbol(gene_symbol=gene_symbol)
        if cpm_normalise:
            logger.debug("Debug: CPM normalising gene expression...")
            gene_expr = gene_expr / self.get_nUMI()
        if log_transform:
            logger.debug("Debug: log-transforming gene expression...")
            gene_expr = np.log2(gene_expr + 1)
        if len(annotation) > 0:
            cell_indices = self.get_anno_cells(annotations=annotation, logic=logic)
            gene_expr = gene_expr[cell_indices]
        else:
            cell_indices = list(range(self.get_nb_cells()))
        return gene_expr, cell_indices

    ############
    # Regulons #
    ############

    def get_regulon_genes(self, regulon):
        try:
            return self.get_genes()[self.loom_connection.ra.Regulons[regulon] == 1]
        except:
            return []

    def has_regulons_AUC(self):
        return "RegulonsAUC" in self.loom_connection.ca.keys()

    def get_regulons_AUC(self):
        loom = self.loom_connection
        L = loom.ca.RegulonsAUC.dtype.names
        loom.ca.RegulonsAUC.dtype.names = list(map(lambda s: s.replace(' ', '_'), L))
        return loom.ca.RegulonsAUC

    def get_auc_values(self, regulon, annotation='', logic='OR'):
        logger.debug("Getting AUC values for {0} ...".format(regulon))
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

    def has_region_gene_links(self):
        return 'linkedGene' in self.loom_connection.ra.keys()

    ##########
    # Metric #
    ##########

    def get_metric(self, metric_name, log_transform=True, cpm_normalise=False, annotation='', logic='OR'):
        if not self.has_ca_attr(name=metric_name):
            raise ValueError("The metric {0} does not exist in the current active loom".format(metric_name))
        logger.debug("getting metric {0}...".format(metric_name))
        metric_vals = self.get_ca_attr_by_name(name=metric_name)
        if cpm_normalise:
            logger.debug("CPM normalising gene expression...")
            metric_vals = metric_vals / self.get_nUMI()
        if log_transform:
            logger.debug("log-transforming gene expression...")
            metric_vals = np.log2(metric_vals + 1)
        if len(annotation) > 0:
            cell_indices = self.get_anno_cells(annotations=annotation, logic=logic)
            metric_vals = metric_vals[cell_indices]
        else:
            cell_indices = list(range(self.get_nb_cells()))
        return metric_vals, cell_indices

    ###############
    # Clusterings #
    ###############

    def get_clustering_by_id(self, clustering_id):
        return self.loom_connection.ca.Clusterings[str(clustering_id)]

    # def get_cluster_IDs(self, loom_file_path, clustering_id):
    #     loom = self.lfh.get_loom_connection(loom_file_path)
    #     return loom.ca.Clusterings[str(clustering_id)]

    def has_cluster_markers(self, clustering_id):
        return "ClusterMarkers_{0}".format(clustering_id) in self.loom_connection.ra.keys()

    def get_cluster_marker_genes(self, clustering_id, cluster_id):
        try:
            return self.get_genes()[self.loom_connection.ra["ClusterMarkers_{0}".format(clustering_id)][str(cluster_id)] == 1]
        except:
            return []

    def get_cluster_marker_metrics(self, clustering_id, cluster_id, metric_accessor):
        cluster_marker_metric = self.loom_connection.row_attrs["ClusterMarkers_{0}_{1}".format(clustering_id, metric_accessor)][str(cluster_id)]
        # Return non-zero values
        return cluster_marker_metric[cluster_marker_metric != 0]
