import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

/** @type {HTMLParagraphElement} **/
let formatFileValue = document.getElementById("file-value")

/** @type {HTMLInputElement} **/
let input = document.getElementById("format-file")

/** @type {HTMLVideoElement} **/
let video = document.getElementById("format-video")

/** @type {HTMLButtonElement} **/
let convertBtn = document.getElementById("format-convert")

/** @type {HTMLSelectElement} **/
let outputNode = document.getElementById("format-voutput")

/** @type {HTMLSelectElement} **/
let vCodecNode = document.getElementById("format-vcodec")

/** @type {HTMLSelectElement} **/
let formatNode = document.getElementById("format-aoutput")

/** @type {HTMLDivElement} **/
let logs = document.getElementById("logs")


/** @type {HTMLDivElement} **/
let progressNode = document.getElementById("convert-progress")

progressNode.style.width = 0

input.addEventListener("change", loadFile)
convertBtn.addEventListener("click", () => transcode(file))

/** @type {File} **/
let file = null
let progress = 0;

const ffmpeg = createFFmpeg({
    log: true,
    progress: ({ ratio }) => {
        progressNode.style.width = ratio * 100 + "%"
        console.log(ratio)
    }
});

/** @param {Event} event **/
function loadFile({ target: { files } }) {
    /** @type {File} event **/
    file = files[0]
    formatFileValue.innerHTML = file.name
}

async function transcode(file) {
    let format = outputNode.value
    let codec = vCodecNode.value

    if (ffmpeg.isLoaded() === false) await ffmpeg.load()

    ffmpeg.FS('writeFile', file.name, await fetchFile(file))

    await ffmpeg.run('-i', file.name, '-vcodec', codec, '-acodec', 'copy', `output.${format}`)
    const data = ffmpeg.FS('readFile', `output.${format}`);

    console.log("read")

    video.controls = "controls"
    video.src = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
}
