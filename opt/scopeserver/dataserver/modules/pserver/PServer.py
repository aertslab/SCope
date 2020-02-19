import sys
import socket
import os
import shutil
import mimetypes
import base64
import functools
import cgi
import tempfile
import time
from http import server as httpserver
import socketserver
from urllib import parse as urllibparse
import loompy as lp
from pathlib import Path, PurePath
import threading

from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.modules.gserver import GServer
from scopeserver.dataserver.utils import sys_utils as su
import logging

logger = logging.getLogger(__name__)

unicode = str


def _decode_str_if_py2(inputstr, encoding='utf-8'):
    "Will return decoded with given encoding *if* input is a string and it's Py2."
    if sys.version_info < (3,) and isinstance(inputstr, str):
        return inputstr.decode(encoding)
    else:
        return inputstr


def _encode_str_if_py2(inputstr, encoding='utf-8'):
    "Will return encoded with given encoding *if* input is a string and it's Py2"
    if sys.version_info < (3,) and isinstance(inputstr, str):
        return inputstr.encode(encoding)
    else:
        return inputstr


def fullpath(path):
    "Shortcut for os.path abspath(expanduser())"
    return os.path.abspath(os.path.expanduser(path))


def basename(path: str) -> str:
    """Extract the file base name (some browsers send the full file path)."""
    return PurePath(path).name


def check_auth(method):
    "Wraps methods on the request handler to require simple auth checks."
    def decorated(self, *pargs):
        "Reject if auth fails."
        if self.auth:
            # TODO: Between minor versions this handles str/bytes differently
            received = self.get_case_insensitive_header('Authorization', None)
            expected = 'Basic ' + base64.b64encode(self.auth).decode()
            # TODO: Timing attack?
            if received != expected:
                self.send_response(401)
                self.send_header('WWW-Authenticate', 'Basic realm=\"Droopy\"')
                self.send_header('Content-type', 'text/html')
                self.end_headers()
            else:
                method(self, *pargs)
        else:
            method(self, *pargs)
    functools.update_wrapper(decorated, method)
    return decorated


class Abort(Exception):
    "Used by handle to rethrow exceptions in ThreadedHTTPServer."


class DroopyFieldStorage(cgi.FieldStorage):
    """
    The file is created in the destination directory and its name is
    stored in the tmpfilename attribute.

    Adds a keyword-argument "directory", which is where files are to be
    stored. Because of CGI magic this might not be thread-safe.
    """

    TMPPREFIX = 'tmpdroopy'

    # Would love to do a **kwargs job here but cgi has some recursive
    # magic that passes all possible arguments positionally..
    def __init__(self, fp=None, headers=None, outerboundary=b'',
                 environ=os.environ, keep_blank_values=0, strict_parsing=0,
                 limit=None, encoding='utf-8', errors='replace',
                 directory='.'):
        """
        Adds 'directory' argument to FieldStorage.__init__.
        Retains compatibility with FieldStorage.__init__ (which involves magic)
        """
        self.directory = directory
        # Not only is cgi.FieldStorage full of magic, it's DIFFERENT
        # magic in Py2/Py3. Here's a case of the core library making
        # life difficult, in a class that's *supposed to be subclassed*!
        if sys.version_info > (3,):
            cgi.FieldStorage.__init__(self, fp, headers, outerboundary,
                                      environ, keep_blank_values,
                                      strict_parsing, limit, encoding, errors)
        else:
            cgi.FieldStorage.__init__(self, fp, headers, outerboundary,
                                      environ, keep_blank_values,
                                      strict_parsing)

    # Binary is passed in Py2 but not Py3.
    def make_file(self, binary=None):
        "Overrides builtin method to store tempfile in the set directory."
        fd, name = tempfile.mkstemp(dir=self.directory, prefix=self.TMPPREFIX)
        # Pylint doesn't like these if they're not declared in __init__ first,
        # but setting tmpfile there leads to odd errors where it's never re-set
        # to a file descriptor.
        self.tmpfile = os.fdopen(fd, 'w+b')
        self.tmpfilename = name
        return self.tmpfile


class HTTPUploadHandler(httpserver.BaseHTTPRequestHandler):

    # Overwrite log_message from BaseHTTPRequestHandler to keep style of SCope
    def log_message(self, format, *args):
        logger.debug(' '.join([str(x) for x in [*args]]))
    "The guts of Droopy-a custom handler that accepts files & serves templates"

    @property
    def templates(self):
        "Ensure provided."
        raise NotImplementedError("Must set class with a templates dict!")

    @property
    def localisations(self):
        "Ensure provided."
        raise NotImplementedError("Must set class with a localisations dict!")

    @property
    def directory(self):
        "Ensure provided."
        raise NotImplementedError("Must provide directory to host.")

    message = ''
    picture = ''
    file_mode = None
    protocol_version = 'HTTP/1.0'
    form_field = 'file'
    auth = ''
    certfile = None

    def get_case_insensitive_header(self, hdrname, default):
        "Python 2 and 3 differ in header capitalisation!"
        lc_hdrname = hdrname.lower()
        lc_headers = dict((h.lower(), h) for h in self.headers.keys())
        if lc_hdrname in lc_headers:
            return self.headers[lc_headers[lc_hdrname]]
        else:
            return default

    @staticmethod
    def prefcode_tuple(prefcode):
        "Parse language preferences into (preference, language) tuples."
        prefbits = prefcode.split(";q=")
        if len(prefbits) == 1:
            return (1, prefbits[0])
        else:
            return (float(prefbits[1]), prefbits[0])

    def parse_accepted_languages(self):
        "Parse accept-language header"
        lhdr = self.get_case_insensitive_header('accept-language', default='')
        if lhdr:
            accepted = [self.prefcode_tuple(lang) for lang in lhdr.split(',')]
            accepted.sort()
            accepted.reverse()
            return [x[1] for x in accepted]
        else:
            return []

    def choose_language(self):
        "Choose localisation based on accept-language header (default 'en')"
        accepted = self.parse_accepted_languages()
        # -- Choose the appropriate translation dictionary (default is english)
        lang = "en"
        for alang in accepted:
            if alang in self.localisations:
                lang = alang
                break
        return self.localisations[lang]

    @check_auth
    def do_GET(self):
        "Standard method to override in this Server object."
        dfh.DataFileHandler().get_data_dir_path_by_file_type(file_type='Loom')

        name = self.path.lstrip('/')
        if name == '':
            return None
        logger.debug(name)

        name = urllibparse.unquote(name)
        name = _decode_str_if_py2(name, 'utf-8')

        # TODO: Refactor special-method handling to make more modular?
        # Include ability to self-define "special method" prefix path?
        # TODO Verify that this is path-injection proof
        localpath = _encode_str_if_py2(os.path.join(self.directory, name), "utf-8")
        with open(localpath, 'rb') as f:
            self.send_resp_headers(200,
                                   {'Content-length': os.fstat(f.fileno())[6],
                                    'Access-Control-Allow-Origin': '*',
                                    'Content-type': 'application/x-hdf5',
                                    'Content-Disposition': 'attachment; filename="' + os.path.basename(name) + '""'},
                                   end=True)
            shutil.copyfileobj(f, self.wfile)

    @check_auth
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    @check_auth
    def do_OPTIONS(self):
        logger.info('In do OPTIONS')
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS, POST')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Headers", "Content-Disposition")
        self.end_headers()
        logger.info('End do OPTIONS')

    @check_auth
    def do_POST(self):
        "Standard method to override in this Server object."
        # try:
        logger.info("Started file transfer")
        form = DroopyFieldStorage(fp=self.rfile,
                                  directory='',
                                  headers=self.headers,
                                  environ={'REQUEST_METHOD': self.command})

        data_file_handler = dfh.DataFileHandler()

        if 'loomFilePath' in form.keys():
            self.directory = data_file_handler.get_data_dir_path_by_file_type(file_type=form.getvalue('file-type'))
            localpath = _encode_str_if_py2(os.path.join(self.directory, form.getvalue('loomFilePath')), "utf-8")
            with open(localpath, 'rb') as f:
                self.send_resp_headers(200,
                                       {'Content-length': os.fstat(f.fileno())[6],
                                        'Access-Control-Allow-Origin': '*',
                                        'Content-type': 'application/x-hdf5'},
                                       end=True)
                shutil.copyfileobj(f, self.wfile)
        else:
            if form.getvalue('file-type') in data_file_handler.get_data_dirs().keys():
                self.directory = data_file_handler.get_data_dir_path_by_file_type(file_type=form.getvalue('file-type'), UUID=form.getvalue('UUID'))
            else:
                self.send_error(415, "Unsupported file type")
                return None
            data_file_handler.update_UUID_db()
            try:
                if data_file_handler.current_UUIDs[form.getvalue('UUID')][1] == 'ro':
                    self.send_error(403, 'Session is read-only')
                    return None
            except KeyError:
                pass

            # Update the directory of DroopyFieldStorage
            form.directory = self.directory
            logger.info("Saving uploaded file in {0}".format(self.directory))
            file_items = form[self.form_field]

            # Handle multiple file upload
            if not isinstance(file_items, list):
                file_items = [file_items]
            for item in file_items:
                filename = _decode_str_if_py2(basename(item.filename), "utf-8")
                if filename == "":
                    continue
                localpath = _encode_str_if_py2(os.path.join(self.directory, filename), "utf-8")
                root, ext = os.path.splitext(localpath)
                i = 1
                # TODO: race condition...
                while os.path.exists(localpath):
                    localpath = "%s-%d%s" % (root, i, ext)
                    i = i + 1
                if hasattr(item, 'tmpfile'):
                    # DroopyFieldStorage.make_file() has been called
                    item.tmpfile.close()
                    shutil.move(item.tmpfilename, localpath)
                else:
                    # no temporary file, self.file is a StringIO()
                    # see cgi.FieldStorage.read_lines()
                    with open(localpath, "wb") as fout:
                        shutil.copyfileobj(item.file, fout)
                if self.file_mode is not None:
                    os.chmod(localpath, self.file_mode)
                logger.info("Received: {0}".format(os.path.basename(localpath)))

            # -- Reply
            # The file list gives a feedback for the upload success
            ctype = mimetypes.guess_type(localpath)[0]
            try:
                # Always read in binary mode. Opening files in text mode may cause
                # newline translations, making the actual size of the content
                # transmitted *less* than the content-length!
                if form.getvalue('file-type') == 'Loom':
                    try:
                        with lp.connect(localpath, mode='r', validate=False) as f:
                            logger.debug('Loom dimensions: {0}'.format(f.shape))
                            if not (f.shape[0] > 0 and f.shape[1] > 0):
                                raise KeyError
                            else:
                                f = open(localpath, 'rb')
                    except (KeyError, OSError):
                        os.remove(localpath)
                        self.send_response(415, message='Upload Corrupt')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        return None
                else:
                    logger.error('Not a loom: {0}'.format(form.getvalue('file-type')))
                    f = open(localpath, 'rb')
            except IOError:
                self.send_error(404, "File not found")
                return None
            # Send correct HTTP headers and Allow CROS Origin
            fs = os.fstat(f.fileno())
            headers = {'Access-Control-Allow-Origin': '*',
                       'Content-Type': 'application/json',
                       'Content-Length': 0,
                       'Last-modified': self.date_time_string(fs.st_mtime)
                       }
            self.send_resp_headers(200, headers, end=True)

        # except Exception as e:
            # self.log_message(">>>" + repr(e))

    def send_resp_headers(self, response_code, headers_dict, end=False):
        "Just a shortcut for a common operation."
        self.send_response(response_code)
        for k, v in headers_dict.items():
            self.send_header(k, v)
        if end:
            self.end_headers()

    def send_html(self, htmlstr):
        "Simply returns htmlstr with the appropriate content-type/status."
        self.send_resp_headers(200, {'Content-type': 'text/html; charset=utf-8'}, end=True)
        self.wfile.write(htmlstr.encode("utf-8"))

    def send_file(self, localpath):
        "Does what it says on the tin! Includes correct content-type/length."
        with open(localpath, 'rb') as f:
            self.send_resp_headers(200,
                                   {'Content-length': os.fstat(f.fileno())[6],
                                    'Content-type': mimetypes.guess_type(localpath)[0]},
                                   end=True)
            shutil.copyfileobj(f, self.wfile)

    def published_files(self):
        "Returns the list of files that should appear as download links."
        names = []
        # In py2, listdir() returns strings when the directory is a string.
        for name in os.listdir(unicode(self.directory)):
            if name.startswith(DroopyFieldStorage.TMPPREFIX):
                continue
            npath = os.path.join(self.directory, name)
            if os.path.isfile(npath):
                names.append(name)
        names.sort(key=lambda s: s.lower())
        return names

    def handle(self):
        "Lets parent object handle, but redirects socket exceptions as 'Abort's."
        try:
            httpserver.BaseHTTPRequestHandler.handle(self)
        except socket.error as e:
            logger.error(str(e))
            raise Abort(str(e))


class ThreadedHTTPServer(socketserver.ThreadingMixIn,
                         httpserver.HTTPServer):
    "Allows propagation of socket.error in HTTPUploadHandler.handle"
    def handle_error(self, request, client_address):
        "Override socketserver.handle_error"
        exctype = sys.exc_info()[0]
        if exctype is not Abort:
            httpserver.HTTPServer.handle_error(self, request, client_address)


def run(run_event,
        hostname='',
        port=50051,
        templates=None,
        localisations=None,
        directory='',
        timeout=3 * 60,
        file_mode=None,
        publish_files=False,
        auth='',
        certfile=None,
        permitted_ciphers=(
            'ECDH+AESGCM:ECDH+AES256:ECDH+AES128:ECDH+3DES'
            ':RSA+AESGCM:RSA+AES:RSA+3DES'
            ':!aNULL:!MD5:!DSS')):
    """
    certfile should be the path of a PEM TLS certificate.

    permitted_ciphers, if a TLS cert is provided, is an OpenSSL cipher string.
    The default here is taken from:
      https://hynek.me/articles/hardening-your-web-servers-ssl-ciphers/
    ..with DH-only ciphers removed because of precomputation hazard.
    """
    # print('Starting PServer on port '+ str(port) +'...')

    # if templates is None or localisations is None:
    #     raise ValueError("Must provide templates *and* localisations.")
    socket.setdefaulttimeout(timeout)
    HTTPUploadHandler.templates = templates
    HTTPUploadHandler.directory = directory
    HTTPUploadHandler.localisations = localisations
    HTTPUploadHandler.certfile = certfile
    HTTPUploadHandler.publish_files = publish_files
    HTTPUploadHandler.file_mode = file_mode
    HTTPUploadHandler.auth = auth
    httpd = ThreadedHTTPServer((hostname, port), HTTPUploadHandler)
    # TODO: Specify TLS1.2 only?
    if certfile:
        try:
            import ssl
        except Exception:
            logger.error("Error: Could not import module 'ssl', exiting.")
            sys.exit(2)

        httpd.socket = ssl.wrap_socket(httpd.socket,
                                       certfile=certfile,
                                       ciphers=permitted_ciphers,
                                       server_side=True)

    # # # Wait a little bit
    # time.sleep(0.5)
    # Let the main process know that PServer has started.
    su.send_msg("PServer", "SIGSTART")

    # Loop
    while run_event.is_set():
        httpd.handle_request()
    # httpd.serve_forever()


def main():
    try:
        run(threading.Event())
    except KeyboardInterrupt:
        logger.info('^C received, awaiting termination of remaining server threads..')


if __name__ == '__main__':
    main()
