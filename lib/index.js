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
var cwd = process.cwd();
var allPackName = '__allpacked';

var config = {};

if (fs.existsSync(path.resolve(cwd, './configs.js'))) {
    config = require(path.resolve(cwd, './configs.js'));
} else if (fs.existsSync(path.resolve(cwd, './kConfig/configs.js'))) {
    config = require(path.resolve(cwd, './kConfig/configs.js'));
}

var concatServerBaseUrl = '.';
var projectPublishRoot = '';

/**
 * 创建项目输出目录
 * @param pageUrl
 */
var mkProjectDir = function (pageUrl) {
    var projectName = path.basename(pageUrl, '.html');
    var projectPath = path.resolve(cwd, './__publish__/' + projectName);
    projectPublishRoot = projectPath;
    if (!fs.existsSync(path.resolve(cwd, './__publish__'))) {
        fs.mkdirSync(path.resolve(cwd, './__publish__'));
    }
    if (fs.existsSync(projectPath)) {
        shell.rm('-rf', projectPath);
    }
    fs.mkdirSync(projectPath);
    fs.mkdirSync(projectPath + '/styles');
    fs.mkdirSync(projectPath + '/scripts');
    fs.mkdirSync(projectPath + '/statics');
};

/**
 * 发布一个项目
 * @param pageUrl 项目入口文件路径
 * @param allPackName 项目配置
 */
var publishOnePage = function (pageUrl, allPackName) {
    console.info('#yellow{<-----pack ' + pageUrl + '----->}:');
    var projectRoot = allPackName || path.basename(pageUrl, '.html');
    var pageName = path.basename(pageUrl, '.html');
    fs.writeFileSync(path.resolve(cwd, './__publish__/' + projectRoot + '/' + pageName + '.html'), analyzeHtml(pageUrl, projectRoot, pageName));
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
 */
var analyzeHtml = function (htmlpath, projectRoot, pageName) {
    var content = fs.readFileSync(path.resolve(cwd, htmlpath), 'utf-8');
    var reg = new RegExp(plugins.reg, 'ig');
    plugins.reset();
    content.replace(reg, function (m) {
        handleMatch('preReplace', arguments, htmlpath, projectRoot, pageName);//replace前做的准备
    });
    return content.replace(reg, function (m) {
        return handleMatch('replace', arguments, htmlpath, projectRoot, pageName);
    });
};

/**
 * 输出项目
 * @param pageUrl 项目入口页面
 */
exports.publish = function (pageUrl) {
    var toServer = /.*_toserver$/g.test(pageUrl); //是否上传到服务器
    if (toServer) { //pageUrl 以 _toserver结尾，表示要发布到服务端，包括cdn，加上配置文件中的serverUrl
        concatServerBaseUrl = config.serverUrl;
        if (concatServerBaseUrl === undefined) {
            console.error('Please check out your config file, and set the attribute "serverUrl"!');
            return;
        }
        pageUrl = pageUrl.replace(/_toserver$/g, '');//去掉 _toserver 后缀
    }
    if (pageUrl === undefined || pageUrl === '') {//pageUrl 原本是 空 或者是 _toserver;
        pageUrl = allPackName;
    }
    mkProjectDir(pageUrl);
    if (pageUrl === allPackName) {
        var files = fs.readdirSync(cwd);
        files.forEach(function (value) {
            if (path.extname(value) === '.html' || path.extname === '.htm') {
                publishOnePage(value, allPackName);
            }
        });
    } else {
        publishOnePage(pageUrl);
    }

    var pageName = path.basename(pageUrl, '.html');
    //拷贝需要的静态资源文件
    if (Array.isArray(config.staticResource)) {
        config.staticResource.forEach(function (val) {
            shell.cp('-Rf',
                path.resolve(cwd, val.source),
                path.resolve(cwd + '/__publish__/' + pageName, val.target));  //styles
        });
    }
};

exports.getConfig = function () {
    return config;
};