var utils = require('./../utils');
var fs = require('fs');
var shell = require('shelljs');
var path = require('path');
var mimer = require('mimer');
var cwd = process.cwd();
require("consoleplusplus");
console.disableTimestamp();
var cleancss = require('clean-css');
var crypto = require('crypto');
var md5;

var addedTohtml = false;
var allCss = [];
var allCssCode = '';
var cped = {};
var concatedCss = {};
exports.reset = function () {
    allCss = [];
    allCssCode = '';
    cped = {};
    concatedCss = {};
    addedTohtml = false;
};

exports.reg = /<(link)\s+[\s\S]*?["'\s\w\/]>\s*/ig;

var converter = {
    /**
     * 将图片转化为base64编码的data-uri形式
     * @param mu        匹配到的值（url(...)）
     * @param uriString 捕获到的uri字符串（./xxx/xxx.xxx?xxx#xxx）
     * @param filename  图片地址
     * @return {string}
     */
    tobase64: function (mu, uriString, filename) {
        if (!fs.existsSync(filename)) {
            console.error('no such file: ' + filename);
            return mu;
        } else {
            console.info('#green{[convert file]} ' + filename + ' #green{to data uri]}\n');
             return mu.replace(uriString, [
                'data:',
                mimer(filename),
                ';base64,',
                fs.readFileSync(filename).toString('base64')
            ].join(''));
        }
    }
};

/**
 * 处理css代码中的静态文件引用
 * @param csscode
 * @param cssPath
 * @param projectPublishRoot
 * @returns {XML|string|void|*}
 */
exports.dealWithUrl = function (csscode, cssPath, projectPublishRoot) {
    return csscode.replace(utils.regs['url'], function (mu, $1, $2, $3, $4) {
        if ($3 === '' || //空 url 不处理
            $3.indexOf('http') === 0) {//网上的资源，直接返回，不处理
            return mu;
        }
        var staticPath = path.resolve(path.dirname(cssPath), $3);
        var psuf = '';
        staticPath = staticPath.replace(/\?.*$|#.*$/ig, function (m) {//处理url中带有 # ？后缀
            psuf = m;
            return '';
        });
        if (Object.keys(converter).indexOf($4) > -1) { // 对命中标记的图片进行处理
            return converter[$4](mu, $3, staticPath);
        }
        shell.cp('-rf', staticPath, projectPublishRoot + '/statics');//拷贝到目标目录
        if (!cped[staticPath]) {
            cped[staticPath] = true;
            console.info('#green{[copy file]} ' + $3 + ' #green{to /statics.]}\n');
        }
        var md5Name = utils.md5file(projectPublishRoot + '/statics/' + path.basename(staticPath));
        return mu.replace($3, '../statics/' + md5Name + psuf); //css会被放到static统计的目录中，因此是 ../statics
    });
};

/**
 * 搜集所有link，拷贝link 所需资源到statics，并将md5后的名称替换css中的名称
 * 收集css代码，并拷贝css依赖的图片等资源到statics中
 * @param m 匹配到的字符串
 * @param htmlpath html页面的路径
 * @param projectRoot 项目原路径
 * @param pageName html页面的名称
 * @param concatServerBaseUrl 上传到cms后，固定的server前缀
 * @param projectPublishRoot 项目发布后的路径
 */
exports.preReplace = function (m, htmlpath, projectRoot, pageName, concatServerBaseUrl, projectPublishRoot) {
    if (m.match(/role\s*=\s*(['"]?)\s*debug\s*\1/) !== null) { //只处理带有role=debug的项
        var getHref = m.match(/(?:\shref\s*=\s*)(['"]?)([^'"\s]*)\1/);
        var cssPath = path.resolve(path.dirname(htmlpath), getHref[2]);
        if (!concatedCss[cssPath]) {
            allCssCode += exports.dealWithUrl(fs.readFileSync(cssPath, 'utf-8'), cssPath, projectPublishRoot);
            allCss.push(m);
            concatedCss[cssPath] = true;
        }
    }
};

/**
 * 替换
 * @param m 匹配到的字符串
 * @param htmlpath html页面的路径
 * @param projectRoot 项目原路径
 * @param pageName html页面的名称
 * @param baseurl 上传到cms后，固定的server前缀
 * @param publishroot 项目发布后的路径
 */
exports.replace = function (m, htmlpath, projectRoot, pageName, baseurl, publishroot) {
    if (m.match(/role\s*=\s*(['"]?)\s*debug\s*\1/) !== null) {//设置为role=debug的标签，删掉
        if (!addedTohtml) {//最后一个link标签
            console.info('#green{[pack css files]}:');
            var mincss = new cleancss().minify(allCssCode);
            mincss = mincss.styles || mincss;//兼容新旧版本的cleancss的minify接口
            md5 = crypto.createHash('md5');
            var cssMd5 = md5.update(mincss)
                .digest('hex')
                .substring(0, 6);
            fs.writeFileSync(path.resolve(cwd, './__publish__/' + projectRoot + '/styles/' + pageName + '_' + cssMd5 + '.css'), mincss);
            allCss.forEach(function (val) {
                console.log(val.match(/(?:\shref\s*=\s*)(['"]?)([^'"\s]*)\1/)[2]);
            });
            console.info('#green{[pack css files done.]}\n');
            addedTohtml = true;
            return '<link rel="stylesheet" href="' + baseurl + '/styles/' + pageName + '_' + cssMd5 + '.css"/>';
        } else {
            return '';
        }
    }
    return m;
};