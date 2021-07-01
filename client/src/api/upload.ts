declare const DEBUG: boolean;
declare const FRONTEND: any;
declare const BACKEND: any;
declare const REVERSEPROXYON: boolean;

export function upload(uuid, type, file, onProgress, onUploaded) {
    if (file === null) {
        alert('Please select a file first');
        return;
    }

    const form = new FormData();
    form.append('UUID', uuid);
    form.append('file-type', type);
    form.append('file', file);

    const XHRport =
        document.head
            .querySelector('[name=scope-xhrport]')
            ?.getAttribute('port') || BACKEND.XHRport;

    const xhr = new XMLHttpRequest();
    if (REVERSEPROXYON) {
        xhr.open(
            'POST',
            FRONTEND.httpProtocol + '://' + FRONTEND.host + '/upload/'
        );
    } else {
        xhr.open(
            'POST',
            BACKEND.httpProtocol +
                '://' +
                BACKEND.host +
                ':' +
                XHRport +
                '/'
        );
    }
    xhr.upload.addEventListener('progress', (event) => {
        if (DEBUG) {
            console.log('Data uploaded: ' + event.loaded + '/' + event.total);
        }
        const progress = ((event.loaded / event.total) * 100).toPrecision(1);
        onProgress(progress);
    });

    xhr.upload.addEventListener('load', (event) => {
        if (DEBUG) {
            console.log('file uploaded: ' + file.name);
        }
    });

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            setTimeout(() => {
                onUploaded(file.name, xhr.status);
            }, 1000);
        }
    };
    xhr.setRequestHeader(
        'Content-Disposition',
        'attachment;filename=' + file.name
    );
    xhr.send(form);
}
