const electron = require('electron')
const fs = require('fs')
const path = require('path')

const md = require('markdown-it')({
    breaks: true,
    highlight: highlight
})
const hljs = require('highlight.js')
const $ = require('jquery')

const renderers = {
    '.md': md
}

// map of filenames to their html links
let links = null
let changed = new Set()
let files = null
// currently displayed file
let dir = null
let current = null

function highlight(code, lang) {
    if (hljs.getLanguage(lang))
        return hljs.highlight(lang, code).value
    else {
        console.log('unknown lang: ' + lang)
        return hljs.highlightAuto(code).value
    }
}

function render(filename) {
    // set current file
    current = filename

    // update title
    $('#menu-title').text(filename)

    // update content
    let data = fs.readFileSync(path.join(dir, filename))
    let text = data.toString()
    let ext = path.extname(filename)

    if (renderers[ext])
        text = renderers[ext].render(text)
    else {
        let lang = ext.substring(1)
        text = `<pre class="clean"><code>${highlight(text, lang)}</code></pre>`
    }
    $('#content').html(text)
    renderMathInElement($('#content')[0], {delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false},
        {left: "\\[", right: "\\]", display: true},
        {left: "\\(", right: "\\)", display: false}
    ]})

    // deal with "changed" flag
    let scroll = 0
    if (changed.has(filename)) {
        // scroll to bottom
        scroll = $('#content').height()
        // clear "changed" class
        changed.delete(filename)
        links[filename].removeClass('changed')

        if (changed.size === 0)
            $('#menu-open').removeClass('changed')
    }
    $('main').animate({ scrollTop: scroll }, 500)
}

let cleanup = null
function scan() {
    let filelist = $('#menu-filelist')
    let filenames = fs.readdirSync(dir)

    // cleanup "changed" flag after interval
    // so that changed.size matches the files displayed
    // (since VIM moves files around, a delay is required)
    if (cleanup)
        clearTimeout(cleanup)
    cleanup = setTimeout(function () {
        changed.forEach(function (val) {
            if (files.indexOf(val) >= 0)
                return
            console.log('clean: ' + val)
            changed.delete(val)
        })
    }, 1000)

    // clean
    filelist.empty()
    links = {}
    files = []

    // add items
    for (let filename of filenames) {
        let stat
        try {
            stat = fs.statSync(path.join(dir, filename))
        } catch (e) {
            // deleted
            continue
        }

        // filter directories
        if (!stat.isFile())
            continue

        // check rendering support
        let ext = path.extname(filename).substring(1)
        if (!renderers[ext] && !hljs.getLanguage(ext))
            continue

        // create link for this file
        let link = $(`<a class="file-link" href="#" onclick="render('${filename}')">${filename}</a>`)

        // if changed, add class
        if (changed.has(filename))
            link.addClass('changed')

        // append and store in links
        filelist.append($('<li></li>').append(link))
        links[filename] = link
        files = files.concat(filename)
    }
}

function watch() {
    fs.watch(dir, function (event, filename) {
        console.log(event + ': ' + filename)
        switch (event) {
            case 'rename': // dir structure change, re-scan files
                scan(dir)
                break

            case 'change': // file changed, update file info
                changed.add(filename)
                if (filename === current) {
                    // update the file on page
                    render(filename)
                    break
                }
                // show this file has been changed
                let link = links[filename]
                if (!link) {
                    break
                }
                link.addClass('changed')
                $('#menu-open').addClass('changed')
                break
        }
    })
}

function next() {
    let id = files.indexOf(current)
    if (id < files.length - 1)
        render(files[id + 1])
}

function prev() {
    let id = files.indexOf(current)
    if (id > 0)
        render(files[id - 1])
}

function firstChanged() {
    for (let filename of files) {
        if (!changed.has(filename))
            continue
        render(filename)
        return
    }
}

electron.ipcRenderer.on('dir', function (event, message) {
    dir = message
    console.log('started in ' + dir)
    scan()
    watch()

    // auto open last file
    if (files.length > 0)
        render(files[files.length - 1])
})
