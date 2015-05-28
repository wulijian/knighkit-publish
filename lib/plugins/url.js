var path = require('path');
var shell = require('shelljs');
var utils = require('./../utils');
require("consoleplusplus");
console.disableTimestamp();
var cped = {};

exports.reg = utils.regs['url'];

exports.reset = function () {
    cped = {};
};

/**
 *
 * @param m 匹配到的字符串
 * @param htmlpath html页面的路径
 * @param projectRoot 项目原路径
 * @param pageName html页面的名称
 * @param baseurl 上传到cms后，固定的server前缀
 * @param publishroot 项目发布后的路径
 */
exports.replace = function (m, htmlpath, projectRoot, pageName, baseurl, publishroot) {
    var cwd = process.cwd();
    var urlStat = m.match(/(url)\((['"]?)([^'"#\)]+(?:#?)(.*))\2\)\s*/);
    if (urlStat === null) {
        return m;
    }
    var imgUrl = urlStat[3];
    if (imgUrl.indexOf('http') === 0 ||//网上的资源，直接返回，不处理
        imgUrl === '') {//空的图片地址不处理
        return m;
    }
    var imgSrc = path.resolve(path.dirname(htmlpath), imgUrl.replace(/\?.*/, ''));//处理图片后面加 ?xxx的情况
    if (/^\/|^\\/.test(imgUrl)) { //以 / 开头的路径，指向项目的根路径，不应指向盘符的根
        imgSrc = path.resolve(cwd, '.' + imgUrl);
    }
    shell.cp('-rf', imgSrc, publishroot + '/statics');//拷贝到目标目录
    if (!cped[imgSrc]) {
        cped[imgSrc] = true;
        console.info('#green{[copy file]} ' + imgUrl.replace(/\?.*/, '') + ' #green{[to /statics.]}\n');
    }
    var md5name = utils.md5file(path.resolve(publishroot + '/statics', path.basename(imgSrc)));//对目标目录的资源名进行md5处理
    return m.replace(imgUrl, (baseurl || '.') + '/statics/' + md5name);
};