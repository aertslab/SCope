import threading
import GServer as gs
import PServer as ps

if __name__ == '__main__':
    t1 = threading.Thread(target=gs.serve)
    t2 = threading.Thread(target=ps.run)
    t1.start()
    t2.start()
