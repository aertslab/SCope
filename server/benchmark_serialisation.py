import timeit
import sqlite3
import psycopg2
import sys
import getopt
import os
import math


def fetch_data(cursor, dataset_id: int, data_format: str):
    query(cursor, dataset_id, data_format)
    res = cursor.fetchone()

    return res


def query(cursor, dataset_id: int, data_format: str):
    cursor.execute(f"SELECT * FROM binary_data WHERE dataset={dataset_id} AND data_format='{data_format}'")


def convert_size(size_bytes):
    if size_bytes == 0:
        return "0B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return "%s %s" % (s, size_name[i])


def main():

    opts, args = getopt.getopt(sys.argv[1:], "n:", ["database=", "dataset="])
    n = 100
    database = None
    dataset_id = None

    for opt, arg in opts:
        if opt == "-n":
            n = int(arg)
        elif opt == "--database":
            database = arg
        elif opt == "--dataset":
            dataset_id = arg

    if database is None:
        print("No database provided. Please add the --database parameter")
        exit()
    if dataset_id is None:
        print("No dataset provided. Please add the --dataset parameter")
        exit()

    if database == "sqlite":
        conn = sqlite3.connect(f"{os.path.dirname(__file__)}/scope.sqlite")
    elif database == "pgsql":
        conn = psycopg2.connect("user=keycloak password=abcdef host=localhost port=5432")
    else:
        print(f"Invalid database {database}")
        exit()

    cursor = conn.cursor()

    print(f"format\ttotal (s)\tavg (ms)\tblob size")
    for data_format in ["loom", "h5", "pq"]:
        result = timeit.timeit(lambda: query(cursor, dataset_id, data_format), number=n)
        data = fetch_data(cursor, dataset_id, data_format)

        if data is None:
            print(f"{data_format}\tNA\t\tNA\t\tNA")
        else:
            if database == "sqlite":
                blob_size = sys.getsizeof(data[2])
            else:
                blob_size = data[2].nbytes  # This is a memoryview
            print(f"{data_format}\t{round(result, 2)}\t\t{round(result*1000/n, 2)}\t\t{convert_size(blob_size)}")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
