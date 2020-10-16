from typing import List, NamedTuple, Iterator, Tuple, Generator, Iterable
import logging
from itertools import groupby

import numpy as np

from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.annotation import Annotation

logger = logging.getLogger(__name__)


class Coordinate(NamedTuple):
    x: float
    y: float


class FeatureLabel(NamedTuple):
    label: str
    colour: str
    coordinate: Coordinate

def uniq(data: Iterable[str]) -> List[str]:
    seen = set()
    result = []

    for x in data:
        if x not in seen:
            seen.add(x)
            result.append(x)

    return result

def label_annotation(loom: Loom, embedding: int, feature: str) -> List[FeatureLabel]:
    """
    Extract and group cells based on annotation. Place labels for each annotation
    at the barycentre of the cell cluster.
    """
    values = loom.get_meta_data_annotation_by_name(name=feature)["values"]
    all_annotations = loom.get_ca_attr_by_name(name=feature)
    colours = uniq((constant.BIG_COLOR_LIST[values.index(i)] for i in all_annotations))

    annotations = uniq(loom.get_ca_attr_by_name(name=feature))

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, annotation in enumerate(annotations):
            coords = loom.get_coordinates(
                coordinatesID=embedding, annotation=[Annotation(name=feature, values=[annotation])]
            )

            yield FeatureLabel(
                label=annotation,
                colour=colours[i],
                coordinate=Coordinate(x=np.mean(coords["x"]), y=np.mean(coords["y"])),
            )

    return [label for label in labels()]
