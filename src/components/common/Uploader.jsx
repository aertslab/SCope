export default class Uploader {
    upload(uuid, type, file, onProgress, onUploaded) {
        if (file == null) {
            alert("Please select a file first")
            return
        }

        let form = new FormData();
        form.append('UUID', uuid);
        form.append('file-type', type);
        form.append('file', file);

        let xhr = new XMLHttpRequest();
        xhr.open("POST", BACKEND.proto + "://" + BACKEND.host + ":" + BACKEND.XHRport + "/");
        xhr.upload.addEventListener('progress', (event) => {
            if (DEBUG) console.log("Data uploaded: " + event.loaded + "/" + event.total);
            let progress = (event.loaded / event.total * 100).toPrecision(1);
            onProgress(progress);
        });
        xhr.upload.addEventListener('load', (event) => {
            if (DEBUG) console.log("file uploaded: " + file.name);
            setTimeout(() => {
                onUploaded(file.name);
            }, 1000);
        })
        xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + file.name)
        xhr.send(form);
    }
}