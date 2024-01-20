/** @type {HTMLAnchorElement} **/
let formatFileValue = document.getElementById("file-value")

/** @param {Event} event **/
function loadAudio(event) {
    formatFileValue.innerHTML = event.target.value
}
