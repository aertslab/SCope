from scopeserver.dataserver.utils.cell_color_by_features import CellColorByFeatures
import numpy as np


def test_normalise_vals():
    vals = np.array([0, 2, 1, 4, 5, 0, 7, 8, 9, 10])
    v_max = 8
    v_min = 2.1
    assert CellColorByFeatures.normalise_vals(vals, v_max, v_min) == [0, 2, 2, 74, 112, 0, 188, 225, 225, 225]


def test_normalise_vals_low_vmax():
    vals = np.array([0, 2, 1, 4, 5, 0, 7, 8, 9, 10])
    v_max = 0.5
    v_min = 0
    assert CellColorByFeatures.normalise_vals(vals, v_max, v_min) == [0, 255, 255, 255, 255, 0, 255, 225, 225, 225]
