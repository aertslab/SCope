import threading

import sys
sys.path.append("/home/luna.kuleuven.be/u0113561/Projects/Programming/SCope/scope-server/slaves/gserver")

from slaves.gserver import GServer as gs
from slaves.pserver import PServer as ps
from slaves.xserver import XServer as xs

if __name__ == '__main__':
    t1 = threading.Thread(target=gs.serve)
    t2 = threading.Thread(target=ps.run)
    t3 = threading.Thread(target=xs.run)
    t1.start()
    t2.start()
    t3.start()
