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
let outputNode = document.getElementById("format-output")

/** @type {HTMLSelectElement} **/
let codecNode = document.getElementById("format-codec")

input.addEventListener("change", loadFile)
convertBtn.addEventListener("click", () => transcode(file))

/** @type {File} **/
let file = null

const ffmpeg = createFFmpeg({
    logger: ({ message }) => console.log(message),
    log: true,
});

/** @param {Event} event **/
function loadFile({ target: { files } }) {
    /** @type {File} event **/
    file = files[0]
    formatFileValue.innerHTML = file.name
}

async function transcode(file) {
    let format = outputNode.value
    let codec = codecNode.value

    if (ffmpeg.isLoaded() === false) await ffmpeg.load()

    await ffmpeg.FS('writeFile', file.name, await fetchFile(file))

    await ffmpeg.run('-i', file.name, '-vcodec', codec, '-acodec', 'copy', `output.${format}`)
    const data = ffmpeg.FS('readFile', `output.${format}`);
    console.log("read")
    video.controls = "controls"
    video.src = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
}