/** @type {String} **/
let url = "https://api.github.com/repos/crimera/Transcriptor/commits"

/** @type {HTMLElement} **/
let hist = document.getElementById('history')


fetch(url).then((response) => {
    return response.json()
}).then((data) => {
    console.log(data)
    data.forEach((item) => {
        hist.appendChild(constructCommitItem(item))
    })
}).catch(() => {
    let p = document.createElement("p")
    p.innerHTML = `Failed to load commit history.`
    hist.appendChild(p)
})

/** @typedef {{ sha: string, commit: {author: {name: string, date: string}, message: string} }} Commit **/
/** @param {Commit} commit**/
/** @returns {HTMLDivElement} commit**/
function constructCommitItem(commit) {
    /** @type {HTMLDivElement} **/
    let commitNode = document.createElement("div")
    commitNode.classList.add("commit")

    let sha = commit.sha.substring(0, 7)
    let date = commit.commit.author.date.substring(0, 10)

    commitNode.innerHTML = `
        <div class="flex justify-between">
            <p>${commit.commit.author.name} &bull; ${sha}</p>
            <p>${date}</p>
        </div>
        <div>
            <p class="commit message">${commit.commit.message}</p>
        </div>
    `

    return commitNode
}
