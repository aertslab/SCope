from scopeserver.modules.gserver import GServer as gs
from scopeserver.modules.pserver import PServer as ps
from scopeserver.modules.xserver import XServer as xs

import threading
import os
import time
from urllib.request import urlopen
import http


def run():
    print('''\
     ____   ____                     ____  ____
    / ___| / ___|___  _ __   ___    |  _ \/ ___|
    \___ \| |   / _ \| '_ \ / _ \   | | | \___ \\
     ___) | |__| (_) | |_) |  __/   | |_| |___) |
    |____/ \____\___/| .__/ \___|   |____/|____/
                     |_|
        ''')
    run_event = threading.Event()
    run_event.set()

    gPort = 50052
    pPort = 50051
    xPort = 8081

    t1 = threading.Thread(target=gs.serve, args=(run_event,), kwargs={'port': gPort})
    t2 = threading.Thread(target=ps.run, args=(run_event,), kwargs={'port': pPort})
    t3 = threading.Thread(target=xs.run, args=(run_event,), kwargs={'port': xPort})
    t1.start()
    t2.start()
    t3.start()

    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print('Terminating servers...')
        run_event.clear()
        t1.join()
        try:
            urlopen('http://127.0.0.1:{0}/'.format(pPort))
        except http.client.RemoteDisconnected:
            pass
        t2.join()
        t3.join()
        print('Servers successfully terminated. Exiting.')


if __name__ == '__main__':
    run()
