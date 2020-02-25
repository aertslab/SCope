const EventEmitter = require('events');
const path = require('path');

export default class FileDownloader extends EventEmitter {
  constructor(loomFilePath, uuid, loomFileSize) {
    super();
    this.loomFilePath = loomFilePath;
    this.uuid = uuid;
    this.loomFileSize = loomFileSize;
    this.formData = new FormData();
  }

  start() {
    if (!this.isConfirmed()) return;
    this.emit('started', true);
    this.completeFormData();
    this.setXHRPort();
    let xhr = this.makeXMLHttpRequest();
    this.sendXMLHttpRequest(xhr);
  }

  isConfirmed() {
    let confirmMsg = `
This loom file is ${parseInt(this.loomFileSize / (1000 * 1000))} MB in size. 
Unlike usual downloads, the file will first be downloaded to memory and then saved to disk. 
Once download begins, you will be unable to stop it without navigating away from this page.\n 
Would you like to continue downloading?
            `;
    return confirm(confirmMsg);
  }

  completeFormData() {
    this.formData.append('loomFilePath', this.loomFilePath);
    this.formData.append('UUID', this.uuid);
    this.formData.append('file-type', 'Loom');
  }

  setXHRPort() {
    try {
      this.XHRport = document.head
        .querySelector('[name=scope-xhrport]')
        .getAttribute('port');
      console.log('Using meta XHRport');
    } catch (ex) {
      console.log('Using config XHRport');
      this.XHRport = BACKEND.XHRport;
    }
  }

  makeXMLHttpRequest() {
    let xhr = new XMLHttpRequest();
    if (REVERSEPROXYON) {
      xhr.open(
        'POST',
        FRONTEND.httpProtocol + '://' + FRONTEND.host + '/upload/'
      );
    } else {
      xhr.open(
        'POST',
        BACKEND.httpProtocol + '://' + BACKEND.host + ':' + this.XHRport
      );
    }
    xhr.responseType = 'blob';
    xhr.upload.addEventListener('load', (event) => {
      if (DEBUG) console.log('file download');
      console.log(xhr, xhr.status, xhr.readyState, xhr.response);
    });

    xhr.onprogress = (evt) => {
      const percent = parseInt((evt.loaded / this.loomFileSize) * 100);
      this.emit('progress', percent);
    };

    xhr.onreadystatechange = () => {
      if (DEBUG) console.log('DL State change');
      console.log(xhr, xhr.status, xhr.readyState, xhr.response);
      if (xhr.readyState == 4 && xhr.status == 200) {
        this.get(xhr);
      }
    };
    return xhr;
  }

  sendXMLHttpRequest(xhr) {
    xhr.send(this.formData);
  }

  get(xhr) {
    console.log('Will download blob');
    const blob = new Blob([xhr.response], { type: 'application/x-hdf5' });
    let a = document.createElement('a');
    a.style = 'display: none';
    document.body.appendChild(a);
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = path.basename(this.loomFilePath);
    a.click();
    window.URL.revokeObjectURL(url);
    this.emit('finished', true);
  }
}
