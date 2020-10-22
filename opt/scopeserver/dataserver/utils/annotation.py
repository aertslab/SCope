"""
Handling annotation data.
"""

from typing import List, NamedTuple


class Annotation(NamedTuple):
    """ An annotation. """

    name: str
    values: List[str]
