var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var md5, config;
var cwd = process.cwd();
var shell = require('shelljs');
require("consoleplusplus");

if (fs.existsSync(path.resolve(cwd, './configs.js'))) {
    config = require(path.resolve(cwd, './configs.js'));
} else if (fs.existsSync(path.resolve(cwd, './kConfig/configs.js'))) {
    config = require(path.resolve(cwd, './kConfig/configs.js'));
}
/**
 * 公用正则，选择相应标签
 */
exports.regs = {
    style: /<(style)(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>)[\s\S]*?(?:<\/style\s*>)\s*/ig,//style
    url: /(url)\((['"]?)([^'"#\)]+(?:#?)(.*?))\2\)\s*/ig,//url
    script: /<(script)(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>)[\s\S]*?(?:<\/script\s*>)\s*/ig,//url
    comment: /<!--[\s\S]*?-->\s*/    //注释
};

/**
 * 将一个文件md5后，重新命名
 * @param destFile 目标文件
 * @returns {XML|string|void}
 */
exports.md5file = function (destFile) {
    md5 = crypto.createHash('md5');
    try {
        var shortMd5 = md5.update(fs.readFileSync(destFile))
            .digest('hex')
            .substring(0, 6);
        var md5FileName = destFile.replace(path.extname(destFile), '_' + shortMd5 + path.extname(destFile));
        fs.renameSync(destFile, md5FileName);
        return path.basename(md5FileName);
    } catch (error) {
        console.error(error);
    }
};

exports.extract = function (sourceUrl) {
    if (!!config.extractTo) {
        var extractToBase = path.resolve(cwd, './' + config.extractTo);
        var fileExtractTo = path.resolve(path.dirname(sourceUrl).replace(cwd, extractToBase));
        shell.mkdir('-p', fileExtractTo);
        shell.cp('-Rf', sourceUrl, fileExtractTo);
        console.info("#green{[extract:]}" + sourceUrl + "\n");
    }
};
