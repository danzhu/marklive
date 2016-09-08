'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

var mainWindow = null;

app.on('window-all-closed', function () {
    app.quit();
});

app.on('ready', function () {
    var dir = process.argv[2];
    if (!dir)
        dir = __dirname;

    mainWindow = new BrowserWindow({ autoHideMenuBar: true });

    //mainWindow.setMenu(null);
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('dir', dir);
    });
});
