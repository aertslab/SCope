import scopeserver.dataserver.modules.gserver.GServer as gs

def test_vmax():
    config = {}
    scope = gs.SCope(config)
    vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 9]
    assert scope.get_vmax(vals) == (9.0, 9)

