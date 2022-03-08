import { END } from 'redux-saga';

export const upload = (
    emitter: (_input: unknown) => void,
    endpoint: string,
    token: string,
    file: File
) => {
    const xhr = new XMLHttpRequest();

    const onProgress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
            const progress = e.loaded / e.total;
            emitter({ progress });
        }
    };

    const onFailure = (_e: ProgressEvent | null) => {
        emitter({ err: 'Upload failed' });
        emitter(END);
    };

    xhr.upload.addEventListener('progress', onProgress);
    xhr.upload.addEventListener('error', onFailure);
    xhr.upload.addEventListener('abort', onFailure);
    xhr.onreadystatechange = () => {
        const { readyState, status, response } = xhr;
        if (readyState === 4) {
            if (status === 200) {
                emitter({ success: true, response: JSON.parse(response) });
                emitter(END);
            } else {
                onFailure(null);
            }
        }
    };

    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    const form = new FormData();
    form.append('uploadfile', file);
    xhr.send(form);

    return () => {
        xhr.upload.removeEventListener('progress', onProgress);
        xhr.upload.removeEventListener('error', onFailure);
        xhr.upload.removeEventListener('abort', onFailure);
        xhr.onreadystatechange = null;
        xhr.abort();
    };
};
