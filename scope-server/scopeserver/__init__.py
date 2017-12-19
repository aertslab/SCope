from modules.gserver import GServer as gs
from modules.pserver import PServer as ps
from modules.xserver import XServer as xs

import threading
import sys

def run():
    t1 = threading.Thread(target=gs.serve)
    t2 = threading.Thread(target=ps.run)
    t3 = threading.Thread(target=xs.run)
    t1.start()
    t2.start()
    t3.start()

if __name__ == '__main__':
    print('''\
 ____   ____                     ____  ____  
/ ___| / ___|___  _ __   ___    |  _ \/ ___| 
\___ \| |   / _ \| '_ \ / _ \   | | | \___ \ 
 ___) | |__| (_) | |_) |  __/   | |_| |___) |
|____/ \____\___/| .__/ \___|   |____/|____/ 
                 |_|                               
    ''')
    run()
