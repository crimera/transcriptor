const dst = "whisper.bin"
const dbName = "ggml-models"
const dbVersion = 1
const modelUrl = "ggml-model-whisper-tiny.en-q5_1.bin"
const size_mb = "51"
let instance = null
let audio = null
let context = null
let filename = null

function parseModel(model) {
    let c = model.indexOf("(")
    return model
        .toLowerCase()
        .slice(0, c)
        .trim()
        .replace(" ", ".")
}

let spinner = document.getElementById("spinner")

document.getElementById('getModelBtn').addEventListener('click', function () {
    let modelChooser = document.getElementById("model")
    let model = modelChooser.value

    console.log(`ggml-model-whisper-${parseModel(model)}-q5_1.bin`)

    loadRemote(`ggml-model-whisper-${parseModel(model)}-q5_1.bin`, dst, size_mb, cbProgress, storeFS, () => { console.log("cancelled") }, cbPrint);
})

let processBtn = document.getElementById('processBtn')

processBtn.addEventListener('click', function () {
    let translate = document.getElementById("translate").checked

    onProcess(this.translate)
})

let transcriptNode = document.getElementById('transcript')

async function fetchRemote(url, cbProgress, cbPrint) {
    const response = await fetch(
        url,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        }
    );

    if (!response.ok) {
        cbPrint('fetchRemote: failed to fetch ' + url);
        return;
    }

    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    const reader = response.body.getReader();

    var chunks = [];
    var receivedLength = 0;
    var progressLast = -1;

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
        receivedLength += value.length;

        if (contentLength) {
            cbProgress(receivedLength / total);

            var progressCur = Math.round((receivedLength / total) * 10);
            if (progressCur != progressLast) {
                cbPrint('fetchRemote: fetching ' + 10 * progressCur + '% ...');
                progressLast = progressCur;
            }
        }
    }

    var position = 0;
    var chunksAll = new Uint8Array(receivedLength);

    for (var chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
    }

    return chunksAll;
}

function loadRemote(url, dst, size_mb, cbProgress, cbReady, cbCancel, cbPrint) {
    if (!navigator.storage || !navigator.storage.estimate) {
        cbPrint('loadRemote: navigator.storage.estimate() is not supported');
    } else {
        // query the storage quota and print it
        navigator.storage.estimate().then(function (estimate) {
            cbPrint('loadRemote: storage quota: ' + estimate.quota + ' bytes');
            cbPrint('loadRemote: storage usage: ' + estimate.usage + ' bytes');
        });
    }

    // check if the data is already in the IndexedDB
    var rq = indexedDB.open(dbName, dbVersion);

    rq.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (db.version == 1) {
            var os = db.createObjectStore('models', { autoIncrement: false });
            cbPrint('loadRemote: created IndexedDB ' + db.name + ' version ' + db.version);
        } else {
            // clear the database
            var os = event.currentTarget.transaction.objectStore('models');
            os.clear();
            cbPrint('loadRemote: cleared IndexedDB ' + db.name + ' version ' + db.version);
        }
    };

    rq.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(['models'], 'readonly');
        var os = tx.objectStore('models');
        var rq = os.get(url);

        rq.onsuccess = function (event) {
            if (rq.result) {
                cbPrint('loadRemote: "' + url + '" is already in the IndexedDB');
                cbReady(dst, rq.result);
            } else {
                // data is not in the IndexedDB
                cbPrint('loadRemote: "' + url + '" is not in the IndexedDB');

                // alert and ask the user to confirm
                if (!confirm(
                    'You are about to download ' + size_mb + ' MB of data.\n' +
                    'The model data will be cached in the browser for future use.\n\n' +
                    'Press OK to continue.')) {
                    cbCancel();
                    return;
                }

                fetchRemote(url, cbProgress, cbPrint).then(function (data) {
                    if (data) {
                        // store the data in the IndexedDB
                        var rq = indexedDB.open(dbName, dbVersion);
                        rq.onsuccess = function (event) {
                            var db = event.target.result;
                            var tx = db.transaction(['models'], 'readwrite');
                            var os = tx.objectStore('models');

                            var rq = null;
                            try {
                                var rq = os.put(data, url);
                            } catch (e) {
                                cbPrint('loadRemote: failed to store "' + url + '" in the IndexedDB: \n' + e);
                                cbCancel();
                                return;
                            }

                            rq.onsuccess = function (event) {
                                cbPrint('loadRemote: "' + url + '" stored in the IndexedDB');
                                cbReady(dst, data);
                            };

                            rq.onerror = function (event) {
                                cbPrint('loadRemote: failed to store "' + url + '" in the IndexedDB');
                                cbCancel();
                            };
                        };
                    }
                });
            }
        };

        rq.onerror = function (event) {
            cbPrint('loadRemote: failed to get data from the IndexedDB');
            cbCancel();
        };
    };

    rq.onerror = function (event) {
        cbPrint('loadRemote: failed to open IndexedDB');
        cbCancel();
    };

    rq.onblocked = function (event) {
        cbPrint('loadRemote: failed to open IndexedDB: blocked');
        cbCancel();
    };

    rq.onabort = function (event) {
        cbPrint('loadRemote: failed to open IndexedDB: abort');
        cbCancel();
    };
}

function cbPrint(message) {
    console.log(message);
}

function cbProgress(message) {
    console.log(message);
}

let exportBtn = document.getElementById("exportBtn")
exportBtn.addEventListener('click', () => {
    let srt = []
    let i = 0
    script.forEach(item => {
        srt.push(tsToSrt(item, ++i))
    })

    downloadString(srt.join('\n\n'), "text/plain", fileToSrt(filename))
})

function fileToSrt(name) {
    let i = name.lastIndexOf('.')
    let fname = name.slice(0, i)
    return `${fname}.srt`
}

var Module = {
    print: (message) => {
        console.log(message)
        addTranscript(message)
    },
    printErr: (message) => {
        if (message.includes("whisper_print_timings")) {
            notify("Done...")
            spinner.style.display = 'none'
            exportBtn.removeAttribute("disabled")
 
            var list = document.getElementsByClassName("transcript");
            for (let item of list) {
                console.log(item.classList.add("show"));
            }
        }
        console.log(message)
    },
    setStatus: function (text) {
        console.log(text)
    },
    monitorRunDependencies: function (left) {
        console.log(left)
    }
};

function storeFS(fname, buf) {
    // write to WASM file using FS_createDataFile
    // if the file exists, delete it
    try {
        Module.FS_unlink(fname);
    } catch (e) {
        // ignore
    }

    Module.FS_createDataFile("/", fname, buf, true, true);

    //model_whisper = fname;

    // document.getElementById('model-whisper-status').innerHTML = 'loaded "' + model_whisper + '"!';

    printTextarea('storeFS: stored model: ' + fname + ' size: ' + buf.length);

    toggleProcessBtn()

    // document.getElementById('model').innerHTML = 'Model fetched: ' + model_whisper;
}

function printTextarea(message) {
    console.log(message)
}

const kMaxAudio_s = 30 * 60;
const kMaxRecording_s = 2 * 60;
const kSampleRate = 16000;

window.AudioContext = window.AudioContext || window.webkitAudioContext;
window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;

function loadPreview(file) {
    if (file.type.indexOf("audio") == 0) {
        type = "audio";
    } else if (file.type.indexOf("video") == 0) {
        type = "video";
    }

    let node = document.createElement(type)
    node.id = "preview"
    node.classList.add("border")
    node.classList.add("rounded")
    node.classList.add("bg-black")
    node.src = URL.createObjectURL(file)
    node.class = "border rounded"
    node.controls = true
    document.getElementById("preview").replaceWith(node)
}

function resetExport() {
    exportBtn.setAttribute("disabled", true)
    script = []
}

function loadAudio(event) {
    exportBtn.setAttribute("disabled", true)
    notify("Loading file...")
    transcriptNode.innerHTML = ''
    resetExport()

    if (!context) {
        context = new AudioContext({
            sampleRate: kSampleRate,
            channelCount: 1,
            echoCancellation: false,
            autoGainControl: true,
            noiseSuppression: true,
        });
    }

    var file = event.target.files[0] || null;
    if (file == null) {
        return;
    }

    loadPreview(file);
    filename = file.name

    printTextarea('js: loading audio: ' + file.name + ', size: ' + file.size + ' bytes');
    printTextarea('js: please wait ...');

    document.getElementById("processBtn").setAttribute("disabled", true)

    var reader = new FileReader();
    reader.onload = function (event) {
        var buf = new Uint8Array(reader.result);

        context.decodeAudioData(buf.buffer, function (audioBuffer) {
            var offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
            var source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0);

            offlineContext.startRendering().then(function (renderedBuffer) {
                audio = renderedBuffer.getChannelData(0);
                printTextarea('js: audio loaded, size: ' + audio.length);

                toggleProcessBtn()
                notify("Loaded audio")

                // truncate to first 30 seconds
                if (audio.length > kMaxAudio_s * kSampleRate) {
                    audio = audio.slice(0, kMaxAudio_s * kSampleRate);
                    printTextarea('js: truncated audio to first ' + kMaxAudio_s + ' seconds');
                }

                // setAudio(audio);
            });
        }, function (e) {
            printTextarea('js: error decoding audio: ' + e);
            audio = null;
            // setAudio(audio);
        });
    }
    reader.readAsArrayBuffer(file);
}

// Transcribe

var nthreads = 8;

function onProcess(translate) {
    if (!instance) {
        instance = Module.init('whisper.bin');

        if (instance) {
            printTextarea("js: whisper initialized, instance: " + instance);
        }
    }

    if (!instance) {
        printTextarea("js: failed to initialize whisper");
        return;
    }

    if (!audio) {
        printTextarea("js: no audio data");
        return;
    }

    if (instance) {
        printTextarea('');
        printTextarea('js: processing - this might take a while ...');
        printTextarea('');

        transcriptNode.innerHTML = ''
        notify("Generating transcript...")
        spinner.style.display = 'block'

        setTimeout(function () {
            var ret = Module.full_default(instance, audio, "en", nthreads, translate);
            console.log('js: full_default returned: ' + ret);
            if (ret) {
                printTextarea("js: whisper returned: " + ret);
            }
        }, 100);
    }
}

Module['onRuntimeInitialized'] = function () {
    console.log("loaded")
}

let count = 0
let script = []

let timeStampRe = /\[(.*?)\]/
function addTranscript(transcript) {
    script.push(transcript)

    let timestamp = transcript.match(timeStampRe)[0]
    let time = parseTimeStamp(timestamp)

    let transcriptNode = document.querySelector("#transcript")

    let content = document.createElement("p")
    content.innerHTML = `
    <div class="transcript">
        <button id="time">${time.start.minute}:${time.start.seconds}</button>
        <p id="${count++}" class="content">${transcript.replace(timestamp, "")}</p>
        <button id="edit" onClick="editContent(this, event)">Edit</button>
    </div>
    `

    transcriptNode.appendChild(content)
    //scrollBottom(transcriptNode)
}

function editContent(node, e) {
    let transcript = node.parentNode
    let content = transcript.children[1]

    if (node.textContent == "Edit") {
        let input = document.createElement("input")
        input.id = content.id
        input.value = content.textContent.trim()
        transcript.replaceChild(input, content)

        input.focus()

        node.textContent = "Done"
        return
    }

    if (node.textContent == "Done") {
        let i = Number(content.id)
        let split = script[i].split("   ")
        script[i] = `${split[0]}   ${content.value.trim()}`

        let input = document.createElement("p")
        input.id = content.id
        input.textContent = content.value
        transcript.replaceChild(input, content)

        node.textContent = "Edit"
        return
    }
}

function tsToSrt(ts, index) {
    let split = ts.split("   ")
    let time = split[0]
    let content = split[1]

    time = time
        .replace('[', '')
        .replace(']', '')
        .replaceAll('.', ',')

    return `${index}\n${time}\n${content}`
}

function scrollBottom(transcriptNode) {
    transcriptNode.scrollTo({
        top: transcriptNode.scrollHeight,
        behavior: "smooth"
    })
}

// Utils
function formatTime(time) {
    let t = parseInt(time);
    return parseInt(t / 60) + ':' + (t % 60 < 10 ? '0' + t % 60 : t % 60);
}

function notify(message) {
    let notification = document.createElement("div")
    notification.id = "notif"
    notification.innerHTML = `
        <h1>${message}</h1>
    `

    let main = document.getElementById("main")
    main.appendChild(notification)

    setTimeout(function () {
        main.removeChild(notification)
    }, 2000);
}

function toggleProcessBtn() {
    processBtn.setAttribute("disabled", true)

    if (!instance) {
        instance = Module.init('whisper.bin');

        if (instance) {
            printTextarea("js: whisper initialized, instance: " + instance);
        }
    }

    if (!instance) {
        return;
    }

    if (!audio) {
        return;
    }

    processBtn.removeAttribute("disabled")
}

function parseTimeStamp(timestamp) {
    timestamp = timestamp
        .replace('[', '')
        .replace(']', '')

    timestamp = timestamp.split('-->')
    let startComplete = timestamp[0].split(':')
    let endComplete = timestamp[1].split(':')

    let start = {
        hour: startComplete[0],
        minute: startComplete[1],
        seconds: startComplete[2].slice(0, 2),
        milis: startComplete[2].slice(-3)
    }
    let end = {
        hour: endComplete[0],
        minute: endComplete[1],
        seconds: endComplete[2].slice(0, 2),
        milis: endComplete[2].slice(-3)
    }

    return {
        start,
        end
    }
}

function downloadString(text, fileType, fileName) {
    var blob = new Blob([text], { type: fileType });

    var a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(blob);
    a.dataset.downloadurl = [fileType, a.download, a.href].join(':');
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
}
