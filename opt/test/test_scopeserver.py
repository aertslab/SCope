import scopeserver.dataserver.modules.gserver.GServer as gs

scope = gs.SCope()

def test_vmax():
    vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 9]
    assert scope.get_vmax(vals) == (9.0, 9)

