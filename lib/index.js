/**
 * 按入口页面输出项目
 */
var path = require('path');
var fs = require('fs');
var shell = require('shelljs');
var utils = require('./utils');
require("consoleplusplus");
console.disableTimestamp();
var plugins = require('./plugins');
var tagExtension = require('knighkit-tag-extension');
var cwd = process.cwd();

var config = {};

if (fs.existsSync(path.resolve(cwd, './configs.js'))) {
    config = require(path.resolve(cwd, './configs.js'));
} else if (fs.existsSync(path.resolve(cwd, './kConfig/configs.js'))) {
    config = require(path.resolve(cwd, './kConfig/configs.js'));
}

var concatServerBaseUrl = '.';
var projectPublishRoot = '';

var getPageDir = function (subPage) {
    var projectPath = path.resolve(cwd, './__publish__');
    return /\/pages\/|\\pages\\/.test(subPage) ? path.join(projectPath, path.relative(path.resolve(cwd, './pages'), path.dirname(subPage)))//处于正宗的pages文件夹中，播出pages这一层，建立文件夹
        : path.join(projectPath, path.relative(cwd, path.dirname(subPage)));
};

/**
 * 创建项目输出目录
 * @param pageUrl
 */
var mkProjectDir = function () {
    var projectPath = path.resolve(cwd, './__publish__');
    projectPublishRoot = projectPath;
    if (!fs.existsSync(path.resolve(cwd, './__publish__'))) {
        fs.mkdirSync(path.resolve(cwd, './__publish__'));
    }
    fs.mkdirSync(projectPath + '/styles');
    fs.mkdirSync(projectPath + '/scripts');
    fs.mkdirSync(projectPath + '/statics');

    pageToPublish.forEach(function (subPage) {
        var dirPath = getPageDir(subPage);
        if (!fs.existsSync(dirPath)) {
            shell.mkdir('-p', dirPath);
        }
    });
};

/**
 * 发布一个项目
 * @param pageUrl 项目入口文件路径
 * @param toServer 是否上传到服务器
 */
var publishOnePage = function (pageUrl, toServer) {
    console.info('#yellow{<-----pack ' + pageUrl + '----->}:');
    var projectRoot = getPageDir(pageUrl);
    if (!!config.extractTo) {
        var extractToBase = path.resolve(cwd, './' + config.extractTo);
        var fileExtractTo = path.resolve(path.dirname(pageUrl).replace(cwd, extractToBase));
        shell.mkdir('-p', fileExtractTo);
        shell.cp('-Rf', pageUrl, fileExtractTo);
        console.info("#green{[extract:]}" + pageUrl + "\n");
    }
    var pageName = path.basename(path.basename(pageUrl, '.html'), '.htm');
    var htmlCode = analyzeHtml(pageUrl, path.resolve(cwd, './__publish__'), pageName, toServer);
    var minify = require('html-minifier').minify;
    if (!/^<\?xml.*\?>/.test(htmlCode)) {
        htmlCode = minify(htmlCode, config.htmlmin || {});
    }
    console.info('#yellow{minify ' + pageUrl + ' done}\n\n');
    fs.writeFileSync(projectRoot + '/' + pageName + '.htm', htmlCode);
    console.info('#yellow{<-----pack ' + pageUrl + ' done----->}\n\n');
};

/**
 * 处理匹配的类型
 * @param type
 * @param args
 * @param htmlpath
 * @param projectRoot
 * @param pageName
 * @returns {*}
 */
var handleMatch = function (type, args, htmlpath, projectRoot, pageName) {
    var plugin = plugins.use(args);
    if (plugin[type] !== undefined) {
        return plugin[type](args[0], htmlpath, projectRoot, pageName, concatServerBaseUrl, projectPublishRoot);
    } else {
        return args[0];
    }
};

/**
 * 获取<script ... src="path"></script>
 * 获取<img ... src="path"></script>
 * 获取<link ... rel="stylesheet" href="path" />
 * @param htmlpath html文件的路径
 * @param projectRoot 项目根目录
 * @param pageName 页面文件名
 * @param toServer  是否上传到服务器，当不上传到服务器，只在本地测试时，需要把include的页面也直接静态的合并到页面代码中，否则不支持include语法
 *
 */
var analyzeHtml = function (htmlpath, projectRoot, pageName, toServer) {
    var content = tagExtension.puz(path.resolve(cwd, htmlpath));
    if (!toServer) {
        content = tagExtension.multiTag(path.resolve(cwd, htmlpath));
    }
    var reg = new RegExp(plugins.regsExceptScript, 'ig');
    plugins.reset();

    //预处理某些css等资源
    content.replace(reg, function (m) {
        handleMatch('preReplace', arguments, htmlpath, projectRoot, pageName);//replace前做的准备
    });

    //单独处理script标签，因为script中同时包含页面所需的css和其他静态资源
    content = content.replace(utils.regs['script'], function (m) {
        return handleMatch('replace', arguments, htmlpath, projectRoot, pageName);
    });

    return content.replace(reg, function (m) {
        return handleMatch('replace', arguments, htmlpath, projectRoot, pageName);
    });
};

var isLegalFile = function (url) {
    var pass = false;
    var filters = config.htmlPublishFilter || [/\.htm$|\.html$/];
    var uniUrl = url.replace(/\//g, '\\');//统一成window中的路径形式
    for (var idx = 0; idx < filters.length; idx++) {
        if (filters[idx].test(uniUrl.replace(/\//g, '\\'))) {
            pass = true;
            break;
        }
    }
    return pass;
};

/**
 * 发布所有的页面
 * @param dir
 */
var pageToPublish = [];
var collectAllPages = function (dir) {
    var stat = fs.statSync(dir);
    if (stat.isDirectory()) {
        var files = fs.readdirSync(dir);
        files.forEach(function (value) {
            var realPath = path.join(dir, value);
            var stat = fs.statSync(realPath);
            if (stat.isDirectory() && value !== 'src' && value !== 'kConfig' && value !== 'lib' && value !== 'output') {
                collectAllPages(realPath);
            } else if (isLegalFile(realPath)) {
                pageToPublish.push(realPath);
            }
        });
    } else {
        pageToPublish.push(dir);
    }
};


/**
 * 输出项目
 * @param pageUrl 项目入口页面
 */
exports.publish = function (pageUrl) {
    pageToPublish = [];//重置
    shell.rm('-rf', path.resolve(cwd, './__publish__'));//清除原生成文件
    var toServer = /.*_toserver$/g.test(pageUrl); //是否上传到服务器
    if (toServer) { //pageUrl 以 _toserver结尾，表示要发布到服务端，包括cdn，加上配置文件中的serverUrl
        concatServerBaseUrl = config.serverUrl;
        if (concatServerBaseUrl === undefined) {
            console.error('Please check out your config file, and set the attribute "serverUrl"!');
            return;
        }
        pageUrl = pageUrl.replace(/_toserver$/g, '');//去掉 _toserver 后缀
    }

    collectAllPages(path.resolve(cwd, pageUrl || ""));

    mkProjectDir(pageUrl);

    pageToPublish.forEach(function (value) {
        publishOnePage(value, toServer);
    });

    var pageName = path.basename(path.basename(pageUrl, '.html'), '.htm');
    if (pageName === 'undefined' || pageName === 'pages') {
        pageName = '';
    }
    //拷贝需要的静态资源文件
    if (Array.isArray(config.staticResource)) {
        config.staticResource.forEach(function (val) {
            var sourcePath = path.resolve(cwd, val.source);
            if (fs.existsSync(sourcePath)) {
                shell.cp('-Rf',
                    sourcePath,
                    path.resolve(cwd + '/__publish__/' + (pageName || ''), val.target));  //styles
            } else {
                console.error('#red{[file not exist]}:' + sourcePath + '\n');
            }
        });
    }
    if (!!config.extractTo) {
        shell.cp('-Rf',
            path.join(cwd, 'kConfig'),
            path.resolve(cwd, './' + config.extractTo));  //styles
        console.info("#green{[extract:]} kConfig 配置文件\n");
        console.warn("#red{项目配置文件，文档，单元测试等，请自行处理！}\n")
    }
};

exports.getConfig = function () {
    return config;
};