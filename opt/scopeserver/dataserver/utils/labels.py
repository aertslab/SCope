from typing import List, NamedTuple, Iterator, Tuple, Generator
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


def label_annotation(loom: Loom, embedding: int, feature: str) -> List[FeatureLabel]:
    """  """
    annotations = groupby(sorted(loom.get_ca_attr_by_name(name=feature)))

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, (annotation, _) in enumerate(annotations):
            coords = loom.get_coordinates(
                coordinatesID=embedding, annotation=[Annotation(name=feature, values=[annotation])]
            )

            yield FeatureLabel(
                label=annotation,
                colour=constant.BIG_COLOR_LIST[i],
                coordinate=Coordinate(x=np.mean(coords["x"]), y=np.mean(coords["y"])),
            )

    return [label for label in labels()]
