var electron = require('electron');
var marked = require('marked');
var hljs = require('highlight.js');
var fs = require('fs');
var path = require('path');
var $ = require('jquery');

marked.setOptions({
    highlight: highlight,
    breaks: true
});

var renderers = {
    '.md': marked
};

// map of filenames to their html links
var links = null;
var changed = new Set();
var files = null;
// currently displayed file
var dir = null;
var current = null;

function highlight(code, lang) {
    if (hljs.getLanguage(lang))
        return hljs.highlight(lang, code).value;
    else {
        console.log('unknown lang: ' + lang);
        return hljs.highlightAuto(code).value;
    }
}

function render(filename) {
    // set current file
    current = filename;

    // update title
    $('#menu-title').text(filename);

    // update content
    var data = fs.readFileSync(path.join(dir, filename));
    var text = data.toString();
    var ext = path.extname(filename);

    if (renderers[ext])
        text = renderers[ext](text);
    else {
        var lang = ext.substring(1);
        text = '<pre class="clean"><code>' + highlight(text, lang) + '</code></pre>';
    }
    $('#content').html(text);
    MathJax.Hub.Typeset($('#content')[0]);

    // deal with "changed" flag
    var scroll = 0;
    if (changed.has(filename)) {
        // scroll to bottom
        scroll = $('#content').height();
        // clear "changed" class
        changed.delete(filename);
        links[filename].removeClass('changed');

        if (changed.size === 0)
            $('#menu-open').removeClass('changed');
    }
    $('main').animate({ scrollTop: scroll }, 500);
}

var cleanup = null;
function scan() {
    var filelist = $('#menu-filelist');
    var filenames = fs.readdirSync(dir);

    // cleanup "changed" flag after interval
    // so that changed.size matches the files displayed
    // (since VIM moves files around, a delay is required)
    if (cleanup)
        clearTimeout(cleanup);
    cleanup = setTimeout(function () {
        changed.forEach(function (val) {
            if (files.indexOf(val) >= 0)
                return;
            console.log('clean: ' + val);
            changed.delete(val);
        });
    }, 1000);

    // clean
    filelist.empty();
    links = {};
    files = [];

    // add items
    for (var i in filenames) {
        var filename = filenames[i];
        try {
            var stat = fs.statSync(path.join(dir, filename));
        } catch (e) {
            // deleted
            continue;
        }

        // filter directories
        if (!stat.isFile())
            continue;

        // check rendering support
        var ext = path.extname(filename).substring(1);
        if (!renderers[ext] && !hljs.getLanguage(ext))
            continue;

        // create link for this file
        var link = $(`<a class="file-link" href="#" onclick="render('${filename}')">${filename}</a>`);

        // if changed, add class
        if (changed.has(filename))
            link.addClass('changed');

        // append and store in links
        filelist.append($('<li></li>').append(link));
        links[filename] = link;
        files = files.concat(filename);
    }
}

function watch() {
    fs.watch(dir, function (event, filename) {
        console.log(event + ': ' + filename);
        switch (event) {
            case 'rename': // dir structure change, re-scan files
                scan(dir);
                break;
            case 'change': // file changed, update file info
                changed.add(filename);
                if (filename === current) {
                    // update the file on page
                    render(filename);
                    break;
                }
                // show this file has been changed
                var link = links[filename];
                if (!link) {
                    break;
                }
                link.addClass('changed');
                $('#menu-open').addClass('changed');
                break;
        }
    });
}

function next() {
    var id = files.indexOf(current);
    if (id < files.length - 1)
        render(files[id + 1]);
}

function prev() {
    var id = files.indexOf(current);
    if (id > 0)
        render(files[id - 1]);
}

electron.ipcRenderer.on('dir', function (event, message) {
    dir = message;
    console.log('started in ' + dir);
    scan();
    watch();
});

$(function () {
    $('#menu-open').click(function () {
        for (var i in files) {
            var filename = files[i];
            if (!changed.has(filename))
                continue;
            render(filename);
            return;
        }
    });
});
