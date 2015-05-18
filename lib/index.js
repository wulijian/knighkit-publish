var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var cbinPath = path.resolve(__dirname, '../node_modules/casperjs/bin/casperjs');
process.stdin.setEncoding('utf8');
require("consoleplusplus");
console.disableTimestamp();

var paramObj = {};

var allFilesToUpload = [];
var filesAndDirs = {};
var cwd = process.cwd();

/**
 * 将文件添加到param对象中
 * @param filename
 * @param fullUrl
 */
var addToHtmlFiles = function (filename, fullUrl) {
    paramObj.__htmls[filename] = fs.readFileSync(fullUrl, 'utf-8');
};


var baseRoot = "";
/**
 * 遍历本地文件夹下的所有文件
 * @param filedir
 */
var walkAllFiles = function (filedir) {
    var files = fs.readdirSync(filedir);

    files.forEach(function (url) {
        var fullUrl = path.join(filedir, url);
        var stat = fs.statSync(fullUrl);
        if (stat.isDirectory()) {
            walkAllFiles(fullUrl);
        }
        if (stat.isFile()) {
            var pass = true;
            paramObj.staticResourcesFileFilter.forEach(function (val) {
                if (val.test(fullUrl)) {
                    pass = false;
                }
            });
            var isHtml = url.match(/\.html|\.htm/);
            if (isHtml) {
                addToHtmlFiles(path.relative(baseRoot, fullUrl).replace(isHtml[0], '').replace(/\\|\//g, '/'), fullUrl);
            }
            if (pass) { //需要过滤掉的格式
                allFilesToUpload.push(fullUrl);
            }
        }
    });
};

/**
 * 收集本地需要上传的文件
 */
var collectionLocalFiles = function () {
    var localBases = Object.keys(paramObj.staticResourcesMapping);
    localBases.forEach(function (val) {
        allFilesToUpload = [];
        var url = path.resolve(cwd, val);
        if (fs.existsSync(url)) {
            baseRoot = url;
            walkAllFiles(url);
        }
        var serverDir = paramObj.staticResourcesMapping[val];
        serverDir = /\/$/.test(serverDir) ? serverDir : serverDir + '/';
        if (filesAndDirs[serverDir] === undefined) {
            filesAndDirs[serverDir] = {};
        }
        var thisMapping = filesAndDirs[serverDir];
        allFilesToUpload.forEach(function (val) {
            var shortDir = path.dirname(path.relative(url, val)).replace(/\\/, '/');
            if (thisMapping[shortDir] === undefined) {
                thisMapping[shortDir] = [];
            }
            thisMapping[shortDir].push(val);
        });
    });
    paramObj.__files = filesAndDirs;
};

require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * 输入一个字符串
 * @param query
 * @param callback
 */
var stdinOnce = function (query, callback) {
    var stdin = process.openStdin();
    var all = '';
    process.stdout.write(query);
    var hidepass = function (char) {
        char = char + "";
        all += char;
        switch (char) {
            case "\n":
            case "\r":
            case "\u0003":
                stdin.removeListener('data', hidepass);
                if (callback !== undefined) {
                    callback(all);
                }
                break;
            case "\u0004":
                stdin.pause();
                break;
            default:
                if (paramObj.username === undefined) {
                    process.stdout.write("");
                } else {
                    process.stdout.write("\033[1D");
                }

                break;
        }
    };
    process.stdin.on("data", hidepass);
};


/**
 * 开始上传到cms
 * @param stage 阶段
 * produce 生产阶段
 * publish 正式上线
 *
 * publish和默认的区别： publish 只上线 html 页面，不会重新上传在 produce 阶段上传的资源文件。因此，publish 阶段需万分小心，若有修改，
 * 请重新执行produce 或 直接使用默认（不指定阶段）。
 *
 * 默认 = produce + publish
 *
 */
exports.run = function (stage) {
    if (stage === 'produce') { // 生产环境，发布到测试目录类别中
        paramObj.catalog = paramObj.catalog + 'test';
    }
    filesAndDirs = {};
    baseRoot = "";
    paramObj.publishProject = stage === 'publish';
    collectionLocalFiles();
    stdinOnce("username : ", function (username) {
        paramObj.username = username.replace(/\n|\r|\r\n/g, '');
        stdinOnce("password : ", function (password) {
            paramObj.password = password.replace(/\n|\r|\r\n/g, '');
            fs.writeFileSync('./paramObj', JSON.stringify(paramObj));
            var execArgs = [path.resolve(__dirname, './cms_casperjs.js')];
            var casperjs = spawn(cbinPath, execArgs);
            casperjs.stdout.setEncoding('utf8');
            casperjs.stdout.on('data', function (data) {
                console.info(data);
                if (/all complete/.test(data)) {
                    process.exit();
                }
                if (/登录失败，请重新登录/.test(data)) {
                    paramObj.username = undefined;
                    exports.run();
                }
            });
            casperjs.on('exit', function (code) {// 当子进程退出时，检查是否有错误，同时关闭文件流
                if (code != 0) {
                    console.log('Failed: ' + code);
                }
            });
        });
    });
};

exports.setConfig = function (obj) {
    paramObj = obj;
};
