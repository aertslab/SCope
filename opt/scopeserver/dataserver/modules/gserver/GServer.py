from concurrent import futures
import sys
import time
import grpc
import loompy as lp
from loompy import timestamp
from loompy import _version
import os
import secrets
import re
import numpy as np
import pandas as pd
import shutil
import json
import zlib
import base64
import threading
import pickle
import requests
import uuid
from collections import OrderedDict, defaultdict, deque
from functools import lru_cache
from itertools import compress
from pathlib import Path

from scopeserver.dataserver.modules.gserver import s_pb2
from scopeserver.dataserver.modules.gserver import s_pb2_grpc
from scopeserver.dataserver.utils import sys_utils as su
from scopeserver.dataserver.utils import loom_file_handler as lfh
from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils import gene_set_enrichment as _gse
from scopeserver.dataserver.utils import cell_color_by_features as ccbf
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils import search_space as ss
from scopeserver.dataserver.utils.loom import Loom

from pyscenic.genesig import GeneSignature
from pyscenic.aucell import create_rankings, enrichment, enrichment4cells
import logging

logger = logging.getLogger(__name__)

hexarr = np.vectorize('{:02x}'.format)

uploadedLooms = defaultdict(lambda: set())


class SCope(s_pb2_grpc.MainServicer):

    app_name = 'SCope'
    app_author = 'Aertslab'

    orcid_active = False

    def __init__(self, config=None):
        self.dfh = dfh.DataFileHandler()
        self.lfh = lfh.LoomFileHandler()

        self.dfh.load_gene_mappings()
        self.dfh.set_global_data()
        self.lfh.set_global_data()
        self.dfh.read_UUID_db()
        self.dfh.read_ORCID_db()
        self.config = {}
        if config is not None:
            with open(config, 'r') as fh:
                try:
                    self.config = json.loads(fh.read())
                except json.JSONDecodeError:
                    self.config = {}
                    logger.error('Config file is not proper json and will not be used')
            self.test_ORCID_connection()
        else:
            self.config = {}
        dhs = self.config.get('dataHashSecret')
        if not dhs or not dhs.strip():
            new_secret = secrets.token_hex(32)
            self.config['dataHashSecret'] = new_secret
            logger.warning(f'The following secret key will be used to hash annotation data: {new_secret}\nLosing this key will mean all annotations will display as unvalidated.')

    def update_global_data(self):
        self.dfh.set_global_data()
        self.lfh.set_global_data()

    def test_ORCID_connection(self):
        for i in ['orcidAPIClientID', 'orcidAPIClientSecret', 'orcidAPIRedirectURI']:
            if i not in self.config.keys():
                self.orcid_active = False
                return

        r = requests.post('https://orcid.org/oauth/token',
                          data={'client_id': self.config['orcidAPIClientID'],
                                'client_secret': self.config['orcidAPIClientSecret'],
                                'grant_type': 'client_credentials',
                                'scope': '/read-public'
                                }
                          )
        if r.status_code != 200:
            logger.error(f'ORCID connection failed! Please check your credentials. See DEBUG output for more details.')
            logger.debug(f'HTTP Code: {r.status_code}')
            logger.debug(f'ERROR: {r.text}')
            self.orcid_active = False
        else:
            logger.info('ORCID connection successful. Users will be able to authenticate.')
            logger.debug(f"SUCCESS: {r.text}")
            self.orcid_active = True

    def getORCIDStatus(self, request, context):
        return s_pb2.getORCIDStatusReply(active=self.orcid_active)

    def getORCIDiD(self, request, context):
        request_code = request.code
        logger.debug(f'Recieved code "{request_code}" from frontend.')

        if self.orcid_active:
            r = requests.post('https://orcid.org/oauth/token',
                              data={'client_id': self.config['orcidAPIClientID'],
                                    'client_secret': self.config['orcidAPIClientSecret'],
                                    'grant_type': 'authorization_code',
                                    'code': request_code,
                                    'redirect_uri': self.config['orcidAPIRedirectURI']
                                    }
                              )

        if r.status_code != 200 or not self.orcid_active:
            logger.debug(f'ERROR: {r.status_code}')
            logger.debug(f'ERROR: {r.text}')
            return s_pb2.getORCIDiDReply(
                orcid_scope_uuid="null",
                name='null',
                orcid_id="null",
                success=False
            )
        else:
            logger.debug(f"SUCCESS: {r.text}")
            orcid_data = json.loads(r.text)
            success = True

        orcid_scope_uuid = str(uuid.uuid4())

        self.dfh.add_ORCIDiD(orcid_scope_uuid, orcid_data['name'], orcid_data['orcid'])

        return s_pb2.getORCIDiDReply(
            orcid_scope_uuid=orcid_scope_uuid,
            name=orcid_data['name'],
            orcid_id=orcid_data['orcid'],
            success=success
        )

    @lru_cache(maxsize=256)
    def get_features(self, loom, query):
        logger.debug('Searching for {0}'.format(query))
        start_time = time.time()

        if query.startswith('hsap\\'):
            search_space = loom.hsap_ss
            cross_species = 'hsap'
            query = query[5:]
        elif query.startswith('mmus\\'):
            search_space = loom.mmus_ss
            cross_species = 'mmus'
            query = query[5:]
        else:
            search_space = loom.ss
            cross_species = ''

        # Filter the genes by the query

        # Allow caps innsensitive searching, minor slowdown
        start_time = time.time()
        res = []

        queryCF = query.casefold()
        res = [x for x in search_space.keys() if queryCF in x[0]]

        order = deque()

        perfect_match = []
        good_match = []
        bad_match = []
        no_match = []

        for n, r in enumerate(res):
            if r[1] == query or r[0] == queryCF:
                perfect_match.append(r)
                continue
            if r[1].startswith(query) or r[1].endswith(query) or r[0].startswith(queryCF) or r[0].endswith(queryCF):
                good_match.append(r)
                continue
            if query in r[0]:
                bad_match.append(r)
                continue
            if n not in order:
                no_match.append(r)
                continue

        res = sorted(perfect_match) + sorted(good_match) + sorted(bad_match) + sorted(no_match)

        collapsedResults = OrderedDict()
        if cross_species == '':
            for r in res:
                if type(search_space[r]) == list:
                    search_space[r] = tuple(search_space[r])
                if (search_space[r], r[2]) not in collapsedResults.keys():
                    collapsedResults[(search_space[r], r[2])] = [r[1]]
                else:
                    collapsedResults[(search_space[r], r[2])].append(r[1])
        elif cross_species == 'hsap':
            for r in res:
                for dg in self.dfh.hsap_to_dmel_mappings[search_space[r]]:
                    if (dg[0], r[2]) not in collapsedResults.keys():
                        collapsedResults[(dg[0], r[2])] = (r[1], dg[1])
        elif cross_species == 'mmus':
            for r in res:
                for dg in self.dfh.mmus_to_dmel_mappings[search_space[r]]:
                    if (dg[0], r[2]) not in collapsedResults.keys():
                        collapsedResults[(dg[0], r[2])] = (r[1], dg[1])

        descriptions = {x: '' for x in collapsedResults.keys() if x[1] not in ['region_gene_link', 'regulon_target', 'marker_gene', 'cluster_annotation']}

        for r in list(collapsedResults.keys()):
            if cross_species == '':
                description = ''
                synonyms = sorted([x for x in collapsedResults[r]])
                try:
                    synonyms.remove(r[0])
                except ValueError:
                    pass
                if r[1] == 'regulon_target':
                    for regulon in r[0]:
                        description = f'{collapsedResults[r][0]} is a target of {regulon}'
                        if (regulon, 'regulon') not in collapsedResults.keys():
                            collapsedResults[(regulon, 'regulon')] = collapsedResults[r][0]
                            descriptions[(regulon, 'regulon')] = ''
                        if descriptions[(regulon, 'regulon')] != '':
                            descriptions[(regulon, 'regulon')] += ', '
                        descriptions[(regulon, 'regulon')] += description
                    del(collapsedResults[r])

                elif r[1] == 'cluster_annotation':
                    for cluster in r[0]:
                        clustering = int(cluster.split('_')[0])
                        cluster = int(cluster.split('_')[1])
                        clustering_name = loom.get_meta_data_clustering_by_id(clustering, secret=self.config['dataHashSecret'])["name"]
                        cluster = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(clustering, cluster, secret=self.config['dataHashSecret'])
                        cluster_name = cluster["description"]
                        description = f'{collapsedResults[r][0]} is a suggested annotation of {cluster_name}'
                        if (cluster_name, f'Clustering: {clustering_name}') not in collapsedResults.keys():
                            collapsedResults[(cluster_name, f'Clustering: {clustering_name}')] = collapsedResults[r][0]
                            descriptions[(cluster_name, f'Clustering: {clustering_name}')] = ''
                        if descriptions[(cluster_name, f'Clustering: {clustering_name}')] != '':
                            descriptions[(cluster_name, f'Clustering: {clustering_name}')] += ', '
                        descriptions[(cluster_name, f'Clustering: {clustering_name}')] += description
                    del(collapsedResults[r])

                elif r[1] == 'marker_gene':
                    for cluster in r[0]:
                        clustering = int(cluster.split('_')[0])
                        cluster = int(cluster.split('_')[1])
                        clustering_name = loom.get_meta_data_clustering_by_id(clustering, secret=self.config['dataHashSecret'])["name"]
                        cluster = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(clustering, cluster, secret=self.config['dataHashSecret'])
                        cluster_name = cluster["description"]
                        description = f'{collapsedResults[r][0]} is a marker of {cluster_name}'
                        if (cluster_name, f'Clustering: {clustering_name}') not in collapsedResults.keys():
                            collapsedResults[(cluster_name, f'Clustering: {clustering_name}')] = collapsedResults[r][0]
                            descriptions[(cluster_name, f'Clustering: {clustering_name}')] = ''
                        if descriptions[(cluster_name, f'Clustering: {clustering_name}')] != '':
                            descriptions[(cluster_name, f'Clustering: {clustering_name}')] += ', '
                        descriptions[(cluster_name, f'Clustering: {clustering_name}')] += description
                    del(collapsedResults[r])
                elif r[1] == 'region_gene_link':
                    for region in r[0]:
                        description = f'{region} is linked to {collapsedResults[r][0]}'
                        if (region, 'gene') not in collapsedResults.keys():
                            collapsedResults[(region, 'gene')] = collapsedResults[r][0]
                            descriptions[(region, 'gene')] = ''
                        if descriptions[(region, 'gene')] != '':
                            descriptions[(region, 'gene')] += ', '
                        descriptions[(region, 'gene')] += description
                    del(collapsedResults[r])
                elif len(synonyms) > 0:
                    if description != '':
                        description += ', '
                    description += 'Synonym of: {0}'.format(', '.join(synonyms))
                    descriptions[r] = description

            elif cross_species == 'hsap':
                logger.debug(f'Performing hsap cross species search: {query}')
                description = 'Orthologue of {0}, {1:.2f}% identity (Human -> Drosophila)'.format(collapsedResults[r][0], collapsedResults[r][1])
                descriptions[r] = description
            elif cross_species == 'mmus':
                logger.debug(f'Performing mmus cross species search: {query}')
                description = 'Orthologue of {0}, {1:.2f}% identity (Mouse -> Drosophila)'.format(collapsedResults[r][0], collapsedResults[r][1])
                descriptions[r] = description

            # if mapping[result] != result: change title and description to indicate synonym

        logger.debug("{0} genes matching '{1}'".format(len(res), query))
        logger.debug("{0:.5f} seconds elapsed ---".format(time.time() - start_time))
        res = {'feature': [r[0] for r in collapsedResults.keys()],
               'featureType': [r[1] for r in collapsedResults.keys()],
               'featureDescription': [descriptions[r] for r in collapsedResults.keys()]}
        return res

    def compressHexColor(self, a):
        a = int(a, 16)
        a_hex3d = hex(a >> 20 << 8 | a >> 8 & 240 | a >> 4 & 15)
        return a_hex3d.replace("0x", "")

    @staticmethod
    def get_vmax(vals):
        maxVmax = max(vals)
        vmax = np.percentile(vals, 99)
        if vmax == 0 and max(vals) != 0:
            vmax = max(vals)
        if vmax == 0:
            vmax = 0.01
        return vmax, maxVmax

    def getVmax(self, request, context):
        v_max = np.zeros(3)
        max_v_max = np.zeros(3)

        for n, feature in enumerate(request.feature):
            f_v_max = 0
            f_max_v_max = 0
            if feature != '':
                for loomFilePath in request.loomFilePath:
                    l_v_max = 0
                    l_max_v_max = 0
                    loom = self.lfh.get_loom(loom_file_path=loomFilePath)
                    if request.featureType[n] == 'gene':
                        vals, cell_indices = loom.get_gene_expression(
                            gene_symbol=feature,
                            log_transform=request.hasLogTransform,
                            cpm_normalise=request.hasCpmTransform)
                        l_v_max, l_max_v_max = SCope.get_vmax(vals)
                    if request.featureType[n] == 'regulon':
                        vals, cell_indices = loom.get_auc_values(regulon=feature)
                        l_v_max, l_max_v_max = SCope.get_vmax(vals)
                    if request.featureType[n] == 'metric':
                        vals, cell_indices = loom.get_metric(
                            metric_name=feature,
                            log_transform=request.hasLogTransform,
                            cpm_normalise=request.hasCpmTransform)
                        l_v_max, l_max_v_max = SCope.get_vmax(vals)
                    if l_v_max > f_v_max:
                        f_v_max = l_v_max
                if l_max_v_max > f_max_v_max:
                    f_max_v_max = l_max_v_max
            v_max[n] = f_v_max
            max_v_max[n] = f_max_v_max
        return s_pb2.VmaxReply(vmax=v_max, maxVmax=max_v_max)

    def getCellColorByFeatures(self, request, context):
        start_time = time.time()
        try:
            loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        except ValueError:
            return

        cell_color_by_features = ccbf.CellColorByFeatures(loom=loom)

        for n, feature in enumerate(request.feature):
            if request.featureType[n] == 'gene':
                cell_color_by_features.setGeneFeature(request=request, feature=feature, n=n)
            elif request.featureType[n] == 'regulon':
                cell_color_by_features.setRegulonFeature(request=request, feature=feature, n=n)
            elif request.featureType[n] == 'annotation':
                cell_color_by_features.setAnnotationFeature(request=request, feature=feature)
                return cell_color_by_features.getReply()
            elif request.featureType[n] == 'metric':
                cell_color_by_features.setMetricFeature(request=request, feature=feature, n=n)
            elif request.featureType[n].startswith('Clustering: '):
                cell_color_by_features.setClusteringFeature(request=request, feature=feature, n=n, secret=self.config['dataHashSecret'])
                if(cell_color_by_features.hasReply()):
                    return cell_color_by_features.getReply()
            else:
                cell_color_by_features.addEmptyFeature()

        logger.debug("{0:.5f} seconds elapsed getting colours ---".format(time.time() - start_time))
        return s_pb2.CellColorByFeaturesReply(color=None,
                                              compressedColor=cell_color_by_features.get_compressed_hex_vec(),
                                              hasAddCompressionLayer=True,
                                              vmax=cell_color_by_features.get_v_max(),
                                              maxVmax=cell_color_by_features.get_max_v_max(),
                                              cellIndices=cell_color_by_features.get_cell_indices())

    def getCellAUCValuesByFeatures(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        vals, cellIndices = loom.get_auc_values(regulon=request.feature[0])
        return s_pb2.CellAUCValuesByFeaturesReply(value=vals)

    def getNextCluster(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        if request.direction == 'next':
            next_clusterID = request.clusterID + 1
        elif request.direction == 'previous':
            next_clusterID = request.clusterID - 1

        try:
            cluster_metadata = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(request.clusteringID, next_clusterID, secret=self.config['dataHashSecret'])
        except ValueError:
            cluster_metadata = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(request.clusteringID, request.clusterID, secret=self.config['dataHashSecret'])

        f = self.get_features(loom=loom, query=cluster_metadata['description'])
        return s_pb2.FeatureReply(feature=[f['feature'][0]], featureType=[f['featureType'][0]], featureDescription=[f['featureDescription'][0]])

    def getCellMetaData(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        cell_indices = request.cellIndices
        if len(cell_indices) == 0:
            cell_indices = list(range(loom.get_nb_cells()))

        cell_clusters = []
        for clustering_id in request.clusterings:
            if clustering_id != '':
                cell_clusters.append(loom.get_clustering_by_id(clustering_id=clustering_id)[cell_indices])
        gene_exp = []
        for gene in request.selectedGenes:
            if gene != '':
                vals, _ = loom.get_gene_expression(gene_symbol=gene,
                                                   log_transform=request.hasLogTransform,
                                                   cpm_normalise=request.hasCpmTransform)
                gene_exp.append(vals[cell_indices])
        auc_vals = []
        for regulon in request.selectedRegulons:
            if regulon != '':
                vals, _ = gene_exp.append(loom.get_auc_values(regulon=regulon))
                gene_exp.append(vals[[cell_indices]])
        annotations = []
        for anno in request.annotations:
            if anno != '':
                annotations.append(loom.get_ca_attr_by_name(name=anno)[cell_indices].astype(str))

        return s_pb2.CellMetaDataReply(clusterIDs=[s_pb2.CellClusters(clusters=x) for x in cell_clusters],
                                       geneExpression=[s_pb2.FeatureValues(features=x) for x in gene_exp],
                                       aucValues=[s_pb2.FeatureValues(features=x) for x in gene_exp],
                                       annotations=[s_pb2.CellAnnotations(annotations=x) for x in annotations])

    def getFeatures(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        f = self.get_features(loom=loom, query=request.query)
        return s_pb2.FeatureReply(feature=f['feature'], featureType=f['featureType'], featureDescription=f['featureDescription'])

    def getCoordinates(self, request, context):
        # request content
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        c = loom.get_coordinates(coordinatesID=request.coordinatesID,
                                 annotation=request.annotation,
                                 logic=request.logic)
        return s_pb2.CoordinatesReply(x=c["x"], y=c["y"], cellIndices=c["cellIndices"])

    def setAnnotationName(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        success = loom.rename_annotation(request.clusteringID, request.clusterID, request.newAnnoName)
        return s_pb2.SetAnnotationNameReply(success=success)

    def setLoomHierarchy(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        success = loom.set_hierarchy(request.newHierarchy_L1, request.newHierarchy_L2, request.newHierarchy_L3)
        return s_pb2.SetLoomHierarchyReply(success=success)

    def setColabAnnotationData(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        success, message = loom.add_collab_annotation(request, self.config['dataHashSecret'])
        return s_pb2.setColabAnnotationDataReply(success=success, message=message)

    def voteAnnotation(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        success, message = loom.annotation_vote(request, self.config['dataHashSecret'])
        return s_pb2.voteAnnotationReply(success=success, message=message)

    def getRegulonMetaData(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        regulon_genes = loom.get_regulon_genes(regulon=request.regulon)

        if len(regulon_genes) == 0:
            logger.error("Something is wrong in the loom file: no regulon found!")

        meta_data = loom.get_meta_data()
        for regulon in meta_data['regulonThresholds']:
            if regulon['regulon'] == request.regulon:
                autoThresholds = []
                for threshold in regulon['allThresholds'].keys():
                    autoThresholds.append({"name": threshold, "threshold": regulon['allThresholds'][threshold]})
                defaultThreshold = regulon['defaultThresholdName']
                motifName = os.path.basename(regulon['motifData'])
                break

        # min_gene_occurrence_mask = regulon_marker_metrics >= meta_data["regulonSettings"]["min_regulon_gene_occurrence"]
        # # Filter the regulon genes by threshold
        # regulon_genes = regulon_genes[min_gene_occurrence_mask]

        if "regulonSettings" in meta_data:
            metrics = [{'accessor': 'GeneOccurrences', 'name': 'Occurrence', 'description': 'Regulon Target Gene Occurrence'}]

            def get_regulon_marker_metric(regulon_metric):
                return {
                    regulon_metric['accessor']: loom.get_regulon_target_gene_metric(
                        regulon=request.regulon,
                        metric_accessor=regulon_metric['accessor'])
                }
            regulon_marker_metrics_dict = {k: v for e in list(map(get_regulon_marker_metric, metrics)) for k, v in e.items()}
            # Create the mask based on threshold
            mask = regulon_marker_metrics_dict["GeneOccurrences"] >= meta_data["regulonSettings"]["min_regulon_gene_occurrence"]
            # Filter the regulon genes by threshold
            regulon_genes = regulon_genes[mask]
            regulon_marker_metrics = list(
                map(
                    lambda metric: s_pb2.RegulonGenesMetric(
                        accessor=metric['accessor'],
                        name=metric['name'],
                        description=metric['description'],
                        values=regulon_marker_metrics_dict[metric['accessor']][mask]
                    ), metrics
                )
            )
        else:
            regulon_marker_metrics = None

        regulon = {
            "genes": regulon_genes,
            "autoThresholds": autoThresholds,
            "defaultThreshold": defaultThreshold,
            "motifName": motifName,
            "metrics": regulon_marker_metrics
        }

        return s_pb2.RegulonMetaDataReply(regulonMeta=regulon)

    def getMarkerGenes(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        # Check if cluster markers for the given clustering are present in the loom
        if not loom.has_cluster_markers(clustering_id=request.clusteringID):
            logger.info("No markers for clustering {0} present in active loom.".format(request.clusteringID))
            return (s_pb2.MarkerGenesReply(genes=[], metrics=[]))

        genes = loom.get_cluster_marker_genes(clustering_id=request.clusteringID, cluster_id=request.clusterID)
        # Filter the MD clusterings by ID
        md_clustering = loom.get_meta_data_clustering_by_id(id=request.clusteringID, secret=self.config['dataHashSecret'])
        cluster_marker_metrics = None

        if "clusterMarkerMetrics" in md_clustering.keys():
            md_cmm = md_clustering["clusterMarkerMetrics"]

            def create_cluster_marker_metric(metric):
                cluster_marker_metrics = loom.get_cluster_marker_metrics(clustering_id=request.clusteringID,
                                                                         cluster_id=request.clusterID,
                                                                         metric_accessor=metric["accessor"])
                return s_pb2.MarkerGenesMetric(accessor=metric["accessor"],
                                               name=metric["name"],
                                               description=metric["description"],
                                               values=cluster_marker_metrics)

            cluster_marker_metrics = list(map(create_cluster_marker_metric, md_cmm))

        return (s_pb2.MarkerGenesReply(genes=genes, metrics=cluster_marker_metrics))

    def getMyGeneSets(self, request, context):
        userDir = dfh.DataFileHandler.get_data_dir_path_by_file_type('GeneSet', UUID=request.UUID)
        if not os.path.isdir(userDir):
            for i in ['Loom', 'GeneSet', 'LoomAUCellRankings']:
                os.mkdir(os.path.join(self.dfh.get_data_dirs()[i]['path'], request.UUID))

        geneSetsToProcess = sorted(self.dfh.get_gobal_sets()) + sorted([os.path.join(request.UUID, x) for x in os.listdir(userDir)])
        gene_sets = [s_pb2.MyGeneSet(geneSetFilePath=f, geneSetDisplayName=os.path.splitext(os.path.basename(f))[0]) for f in geneSetsToProcess]
        return s_pb2.MyGeneSetsReply(myGeneSets=gene_sets)

    def getMyLooms(self, request, context):
        my_looms = []
        update = False
        userDir = dfh.DataFileHandler.get_data_dir_path_by_file_type('Loom', UUID=request.UUID)
        if not os.path.isdir(userDir):
            for i in ['Loom', 'GeneSet', 'LoomAUCellRankings']:
                os.mkdir(os.path.join(self.dfh.get_data_dirs()[i]['path'], request.UUID))

        self.update_global_data()

        loomsToProcess = sorted(self.lfh.get_global_looms()) + sorted([os.path.join(request.UUID, x) for x in os.listdir(userDir)])

        if request.loomFile:
            if request.loomFile in loomsToProcess:
                loomsToProcess = [request.loomFile]
                update = True
            else:
                logger.error("Requested loom not in all looms")

        for f in loomsToProcess:
            try:
                if f.endswith('.loom'):
                    with open(self.lfh.get_loom_absolute_file_path(f), 'r') as fh:
                        loomSize = os.fstat(fh.fileno())[6]
                    loom = self.lfh.get_loom(loom_file_path=f)
                    if loom is None:
                        continue
                    file_meta = loom.get_file_metadata()
                    if not file_meta['hasGlobalMeta']:
                        try:
                            loom.generate_meta_data()
                            file_meta = loom.get_file_metadata()
                        except Exception as e:
                            logger.error('Failed to make metadata!')
                            logger.error(e)

                    try:
                        L1 = loom.get_global_attribute_by_name(name="SCopeTreeL1")
                        L2 = loom.get_global_attribute_by_name(name="SCopeTreeL2")
                        L3 = loom.get_global_attribute_by_name(name="SCopeTreeL3")
                    except AttributeError:
                        L1 = 'Uncategorized'
                        L2 = L3 = ''
                    my_looms.append(s_pb2.MyLoom(loomFilePath=f,
                                                 loomDisplayName=os.path.splitext(os.path.basename(f))[0],
                                                 loomSize=loomSize,
                                                 cellMetaData=s_pb2.CellMetaData(annotations=loom.get_meta_data_by_key(key="annotations"),
                                                                                 embeddings=loom.get_meta_data_by_key(key="embeddings"),
                                                                                 clusterings=loom.get_meta_data_by_key(key="clusterings", secret=self.config['dataHashSecret'])),
                                                 fileMetaData=file_meta,
                                                 loomHeierarchy=s_pb2.LoomHeierarchy(L1=L1,
                                                                                     L2=L2,
                                                                                     L3=L3)
                                                 )
                                    )
            except ValueError:
                pass
        self.dfh.update_UUID_db()

        return s_pb2.MyLoomsReply(myLooms=my_looms, update=update)

    def getUUID(self, request, context):
        if SCope.app_mode:
            with open(os.path.join(self.dfh.get_config_dir(), 'Permanent_Session_IDs.txt'), 'r') as fh:
                newUUID = fh.readline().rstrip('\n')
                logger.info(f'IP {request.ip} connected to SCope. Running in App mode. Passing UUID {newUUID}.')
        else:
            newUUID = str(uuid.uuid4())
        if newUUID not in self.dfh.get_current_UUIDs().keys():
            logger.info(f'IP {request.ip} connected to SCope. Passing new UUID {newUUID}.')
            self.dfh.get_uuid_log().write("{0} :: {1} :: New UUID ({2}) assigned.\n".format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()), request.ip, newUUID))
            self.dfh.get_uuid_log().flush()
            self.dfh.get_current_UUIDs()[newUUID] = [time.time(), 'rw']  # New sessions are rw
        return s_pb2.UUIDReply(UUID=newUUID)

    def getRemainingUUIDTime(self, request, context):  # TODO: his function will be called a lot more often, we should reduce what it does.
        curUUIDSet = set(list(self.dfh.get_current_UUIDs().keys()))
        for uid in curUUIDSet:
            timeRemaining = int(dfh._UUID_TIMEOUT - (time.time() - self.dfh.get_current_UUIDs()[uid][0]))
            if timeRemaining < 0:
                logger.info('Removing folders of expired UUID: {0}'.format(uid))
                del(self.dfh.get_current_UUIDs()[uid])
                for i in ['Loom', 'GeneSet', 'LoomAUCellRankings']:
                    if os.path.exists(os.path.join(self.dfh.get_data_dirs()[i]['path'], uid)):
                        shutil.rmtree(os.path.join(self.dfh.get_data_dirs()[i]['path'], uid))
        uid = request.UUID
        if uid in self.dfh.get_current_UUIDs().keys():
            logger.info(f'IP {request.ip} connected to SCope. Using UUID {uid} from frontend.')
            startTime = self.dfh.get_current_UUIDs()[uid][0]
            timeRemaining = int(dfh._UUID_TIMEOUT - (time.time() - startTime))
            self.dfh.get_uuid_log().write("{0} :: {1} :: Old UUID ({2}) connected :: Time Remaining - {3}.\n".format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()), request.ip, uid, timeRemaining))
            self.dfh.get_uuid_log().flush()
        else:
            logger.info(f'IP {request.ip} connected to SCope. Using UUID {uid} from frontend.')
            try:
                uuid.UUID(uid)
            except (KeyError, AttributeError):
                old_uid = uid
                uid = str(uuid.uuid4())
                logger.error(f'UUID {old_uid} is malformed. Passing new UUID {uid}')
            self.dfh.get_uuid_log().write("{0} :: {1} :: New UUID ({2}) assigned.\n".format(time.strftime('%Y-%m-%d__%H-%M-%S', time.localtime()), request.ip, uid))
            self.dfh.get_uuid_log().flush()
            self.dfh.get_current_UUIDs()[uid] = [time.time(), 'rw']
            timeRemaining = int(dfh._UUID_TIMEOUT)

        self.dfh.active_session_check()
        if request.mouseEvents >= constant._MOUSE_EVENTS_THRESHOLD:
            self.dfh.reset_active_session_timeout(uid)

        sessionsLimitReached = False

        if len(self.dfh.get_active_sessions().keys()) >= constant._ACTIVE_SESSIONS_LIMIT and uid not in self.dfh.get_permanent_UUIDs() and uid not in self.dfh.get_active_sessions().keys():
            sessionsLimitReached = True
            logger.warning(f'Maximum number of concurrent active sessions ({constant._ACTIVE_SESSIONS_LIMIT}) reached. IP {request.ip} will not be able to access SCope.')

        if uid not in self.dfh.get_active_sessions().keys() and not sessionsLimitReached:
            self.dfh.reset_active_session_timeout(uid)

        sessionMode = self.dfh.get_current_UUIDs()[uid][1]
        return s_pb2.RemainingUUIDTimeReply(UUID=uid, timeRemaining=timeRemaining, sessionsLimitReached=sessionsLimitReached, sessionMode=sessionMode)

    def translateLassoSelection(self, request, context):
        src_loom = self.lfh.get_loom(loom_file_path=request.srcLoomFilePath)
        dest_loom = self.lfh.get_loom(loom_file_path=request.destLoomFilePath)
        src_cell_ids = [src_loom.get_cell_ids()[i] for i in request.cellIndices]
        src_fast_index = set(src_cell_ids)
        dest_mask = [x in src_fast_index for x in dest_loom.get_cell_ids()]
        dest_cell_indices = list(compress(range(len(dest_mask)), dest_mask))
        return s_pb2.TranslateLassoSelectionReply(cellIndices=dest_cell_indices)

    def getCellIDs(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        cell_ids = loom.get_cell_ids()
        slctd_cell_ids = [cell_ids[i] for i in request.cellIndices]
        return s_pb2.CellIDsReply(cellIds=slctd_cell_ids)

    def deleteUserFile(self, request, context):
        self.dfh.update_UUID_db()
        success = False
        basename = os.path.basename(request.filePath)
        finalPath = os.path.join(self.dfh.get_data_dirs()[request.fileType]['path'], request.UUID, basename)
        if self.dfh.current_UUIDs[request.UUID][1] == 'rw':
            if os.path.isfile(finalPath) and (basename.endswith('.loom') or basename.endswith('.txt')):
                logger.info(f'File {request.filePath} deleted at request of user with UUID {request.UUID}.')
                try:
                    os.remove(finalPath)
                    success = True
                except:
                    logger.error(f'OS Error, couldn\'t remove file: {finalPath}')
        else:
            logger.error(f'UUID: {request.UUID} is read-only, but requested to delete file {finalPath}')
        return s_pb2.DeleteUserFileReply(deletedSuccessfully=success)

    def downloadSubLoom(self, request, context):
        start_time = time.time()

        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        loom_connection = loom.get_connection()
        meta_data = loom.get_meta_data()

        file_name = request.loomFilePath
        # Check if not a public loom file
        if '/' in request.loomFilePath:
            l = request.loomFilePath.split("/")
            file_name = l[1].split(".")[0]

        if(request.featureType == "clusterings"):
            a = list(filter(lambda x: x['name'] == request.featureName, meta_data["clusterings"]))
            b = list(filter(lambda x: x['description'] == request.featureValue, a[0]['clusters']))[0]
            cells = loom_connection.ca["Clusterings"][str(a[0]['id'])] == b['id']
            logger.debug("Number of cells in {0}: {1}".format(request.featureValue, np.sum(cells)))
            sub_loom_file_name = file_name + "_Sub_" + request.featureValue.replace(" ", "_").replace("/", "_")
            sub_loom_file_path = os.path.join(self.dfh.get_data_dirs()['Loom']['path'], "tmp", sub_loom_file_name + ".loom")
            # Check if the file already exists
            if os.path.exists(path=sub_loom_file_path):
                os.remove(path=sub_loom_file_path)
            # Create new file attributes
            sub_loom_file_attrs = dict()
            sub_loom_file_attrs["title"] = sub_loom_file_name
            sub_loom_file_attrs['CreationDate'] = timestamp()
            sub_loom_file_attrs["LOOM_SPEC_VERSION"] = _version.__version__
            sub_loom_file_attrs["note"] = "This loom is a subset of {0} loom file".format(Loom.clean_file_attr(file_attr=loom_connection.attrs["title"]))
            sub_loom_file_attrs["MetaData"] = Loom.clean_file_attr(file_attr=loom_connection.attrs["MetaData"])
            # - Use scan to subset cells (much faster than naive subsetting): avoid to load everything into memory
            # - Loompy bug: loompy.create_append works but generate a file much bigger than its parent
            #      So prepare all the data and create the loom afterwards
            logger.debug("Subsetting {0} cluster from the active .loom...".format(request.featureValue))
            sub_matrix = None
            sub_selection = None
            for (_, selection, _) in loom_connection.scan(items=cells, axis=1):
                if sub_matrix is None:
                    sub_matrix = loom_connection[:, selection]
                    sub_selection = selection
                else:
                    sub_matrix = np.concatenate((sub_matrix, loom_connection[:, selection]), axis=1)
                    sub_selection = np.concatenate((sub_selection, selection), axis=0)
                # Send the progress
                processed = len(sub_selection) / sum(cells)
                yield s_pb2.DownloadSubLoomReply(loomFilePath="",
                                                 loomFileSize=0,
                                                 progress=s_pb2.Progress(value=processed, status="Sub Loom Created!"),
                                                 isDone=False)
            logger.debug("Creating {0} sub .loom...".format(request.featureValue))
            lp.create(sub_loom_file_path, sub_matrix, row_attrs=loom_connection.ra, col_attrs=loom_connection.ca[sub_selection], file_attrs=sub_loom_file_attrs)
            with open(sub_loom_file_path, 'r') as fh:
                loom_file_size = os.fstat(fh.fileno())[6]
            logger.debug("Done making loom!")
            logger.debug("{0:.5f} seconds elapsed making loom ---".format(time.time() - start_time))
        else:
            logger.error("This feature is currently not implemented.")
        yield s_pb2.DownloadSubLoomReply(loomFilePath=sub_loom_file_path,
                                         loomFileSize=loom_file_size,
                                         progress=s_pb2.Progress(value=1.0, status="Sub Loom Created!"),
                                         isDone=True)

    # Gene set enrichment
    #
    # Threaded makes it slower because of GIL
    #
    def doGeneSetEnrichment(self, request, context):
        gene_set_file_path = os.path.join(self.dfh.get_gene_sets_dir(), request.geneSetFilePath)
        loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
        gse = _gse.GeneSetEnrichment(scope=self,
                                     method="AUCell",
                                     loom=loom,
                                     gene_set_file_path=gene_set_file_path,
                                     annotation='')

        # Running AUCell...
        yield gse.update_state(step=-1, status_code=200, status_message="Running AUCell...", values=None)
        time.sleep(1)

        # Reading gene set...
        yield gse.update_state(step=0, status_code=200, status_message="Reading the gene set...", values=None)
        with open(gse.gene_set_file_path, 'r') as f:
            # Skip first line because it contains the name of the signature
            gs = GeneSignature(name='Gene Signature #1',
                               gene2weight=[line.strip() for idx, line in enumerate(f) if idx > 0])
        time.sleep(1)

        if not gse.has_AUCell_rankings():
            # Creating the matrix as DataFrame...
            yield gse.update_state(step=1, status_code=200, status_message="Creating the matrix...", values=None)
            loom = self.lfh.get_loom(loom_file_path=request.loomFilePath)
            dgem = np.transpose(loom.get_connection()[:, :])
            ex_mtx = pd.DataFrame(data=dgem,
                                  index=loom.get_ca_attr_by_name("CellID"),
                                  columns=loom.get_genes())
            # Creating the rankings...
            start_time = time.time()
            yield gse.update_state(step=2.1, status_code=200, status_message="Creating the rankings...", values=None)
            rnk_mtx = create_rankings(ex_mtx=ex_mtx)
            # Saving the rankings...
            yield gse.update_state(step=2.2, status_code=200, status_message="Saving the rankings...", values=None)
            lp.create(gse.get_AUCell_ranking_filepath(), rnk_mtx.as_matrix(), {"CellID": loom.get_cell_ids()}, {"Gene": loom.get_genes()})
            logger.debug("{0:.5f} seconds elapsed generating rankings ---".format(time.time() - start_time))
        else:
            # Load the rankings...
            yield gse.update_state(step=2, status_code=200, status_message="Rankings exists: loading...", values=None)
            rnk_loom = self.lfh.get_loom_connection(gse.get_AUCell_ranking_filepath())
            rnk_mtx = pd.DataFrame(data=rnk_loom[:, :],
                                   index=rnk_loom.ra.CellID,
                                   columns=rnk_loom.ca.Gene)

        # Calculating AUCell enrichment...
        start_time = time.time()
        yield gse.update_state(step=3, status_code=200, status_message="Calculating AUCell enrichment...", values=None)
        aucs = enrichment(rnk_mtx, gs).loc[:, "AUC"].values

        logger.debug("{0:.5f} seconds elapsed calculating AUC ---".format(time.time() - start_time))
        yield gse.update_state(step=4, status_code=200, status_message=gse.get_method() + " enrichment done!", values=aucs)

    def loomUploaded(self, request, content):
        uploadedLooms[request.UUID].add(request.filename)
        return s_pb2.LoomUploadedReply()


def serve(run_event, port=50052, app_mode=False, config=None):
    SCope.app_mode = app_mode
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    scope = SCope(config=config)
    s_pb2_grpc.add_MainServicer_to_server(scope, server)
    server.add_insecure_port('[::]:{0}'.format(port))
    server.start()

    # Let the main process know that GServer has started.
    su.send_msg("GServer", "SIGSTART")

    while run_event.is_set():
        time.sleep(0.1)

    # Write UUIDs to file here
    scope.dfh.get_uuid_log().close()
    scope.dfh.update_UUID_db()
    server.stop(0)


if __name__ == '__main__':
    run_event = threading.Event()
    run_event.set()
    serve(run_event=run_event)
