import 'regenerator-runtime/runtime'
import {fromEvent, Observable} from "rxjs";
import {delay, map, switchMap, tap} from "rxjs/operators";
import * as crypto from "crypto";
import {CustomMapFiles} from "./types";
import {Buffer} from "buffer";

function getFiles(input: HTMLInputElement): Observable<FileList> {
    return fromEvent(input, 'change')
        .pipe(
            map((ev: Event) => (ev.target as HTMLInputElement).files)
        );
}

function toStorage(currentFiles: CustomMapFiles, directoryEntry: DirectoryEntry) {
    // const dir = fs.root.getDirectory('cache', {create: true, exclusive: true});
    return async (fileList: FileList): Promise<CustomMapFiles> => {
        const fMap: CustomMapFiles = new Map();
        for (const f of fileList) {
            const hash = await getHash(f);
            console.log(currentFiles.has(hash), hash)
            if (currentFiles.has(hash)) {
                fMap.set(hash, currentFiles.get(hash));
                continue;
            }

            const file = await fsGetFile(directoryEntry, f.name, {
                create: true
            });
            const writer = await fsWriteFile(file);
            writer.write(f);
            fMap.set(hash, file);
        }
        return fMap;
    }
}

async function clearStorage(prevFiles: CustomMapFiles, currentFiles: CustomMapFiles) {
    console.log(prevFiles, currentFiles);
    for (let [hash, file] of prevFiles) {
        if (!currentFiles.has(hash)) {
            await new Promise((resolve, reject) => file.remove(resolve, reject));
        }
    }
}

function generateChecksum(str: crypto.BinaryLike, algorithm?: string, encoding: crypto.HexBase64Latin1Encoding = 'hex') {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str)
        .digest(encoding);
}

function getHash(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
            resolve(generateChecksum(Buffer.from(ev.target.result)));
        }
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    })
}

function fsGetFile(dir: DirectoryEntry, filename: string, options?: Flags) {
    return new Promise<FileEntry>((resolve, reject) => {
        dir.getFile(filename, options, resolve, reject)
    });
}

function fsWriteFile(file: FileEntry) {
    return new Promise<FileWriter>((resolve, reject) => {
        file.createWriter(resolve, reject)
    })
}

function requestQuota(quota: number) {
    navigator.persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;
    return new Promise<number>((resolve, reject) => {
        navigator.persistentStorage.requestQuota(
            quota * 1024 * 1024,
            resolve,
            reject
        );
    });
}

function requestFileSystem(quota: number) {
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    return new Promise<FileSystem>((resolve, reject) => {
        window.requestFileSystem(window.PERSISTENT, quota * 1024 * 1024, resolve, reject);
    });
}

function readContent(dir: DirectoryEntry) {
    const reader = dir.createReader();
    return new Promise<Entry[]>((resolve, reject) =>
        reader.readEntries(
            (entries) => resolve(entries.filter(e => e.isFile)),
            reject,
        )
    )
}

async function listenFileChanges(dir: DirectoryEntry, inputF: HTMLInputElement) {
    let tmpStorage: CustomMapFiles = new Map();
    getFiles(inputF)
        .pipe(
            switchMap(toStorage(tmpStorage, dir)),
            map((data) => [tmpStorage, data]),
            tap(async ([tmp, data]) => {
                await clearStorage(tmp, data);
                const fileNameEl: HTMLSpanElement = document.querySelector('.file-name')
                fileNameEl.classList.remove('is-hidden');
                const fileName = [];
                for (const [hash, file] of data.entries()) {
                    fileName.push(`${file.name} (${hash})`);
                }
                fileNameEl.innerText = fileName.join(', ');
                fileNameEl.title = fileName.join(', ');
            }),
            delay(1000)
        )
        .subscribe(([, data]) => {
            tmpStorage = new Map(data);
            console.log(dir.toURL());
            showFiles(dir);
        });
}

async function showFiles(dir: DirectoryEntry) {
    const entries = await readContent(dir);
    const container = document.getElementById('file-list');
    container.innerHTML = '';
    entries.forEach(e => {
        const fig = document.createElement('figure');
        const image = document.createElement('img');
        fig.classList.add('item');
        image.src = e.toURL();
        console.log(e.toURL());
        image.setAttribute('data-file-name', e.name);
        fig.appendChild(image)
        container.appendChild(fig);
        const removeFile = () => {
            e.remove(console.log, console.error);
            fig.removeEventListener('click', removeFile);
            fig.remove();
        }
        fig.addEventListener('click', removeFile)
    })
}

async function init() {
    const inputF: HTMLInputElement = document.querySelector('#uploadedFile');
    const fileSystemQuota = 100;
    const requestedQuota = await requestQuota(fileSystemQuota);
    if (requestedQuota > 0) {
        console.log(requestedQuota, requestedQuota / 1024 / 1024);
        const fs = await requestFileSystem(fileSystemQuota);
        await listenFileChanges(fs.root, inputF);
        await showFiles(fs.root);
    }
}

init();