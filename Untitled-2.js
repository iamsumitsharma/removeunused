const fs = require('fs');
const dir = '../nodeApi';
const walkSync = require('walk-sync')
var path =  require('path');
var exec = require('shelljs').exec
var startPoint = './server.js'
var rConfig = './rollup.config.js';
var oPath = './_tmp-build.js';
fs.readdir(dir, (err, files) => {
    var filelist = files;
    const generateBundle = `npx rollup ${startPoint} -c ${rConfig} --silent -o ${oPath}`
    exec(generateBundle)
    let rSource = JSON.parse(fs.readFileSync(oPath + '.map')).sources
    // console.log('logging srcs', source);
    rSource = rSource.map((str)  => path.resolve(str));
  console.log('Cleaned Source', rSource);  
    files.forEach(file=> { 
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
           // console.log('here 1' , filelist, file, path.join(dir, file));
            filelist = (walkSync(dir + '/' + file, { includeBasePath: true }));
           // console.log('aa', filelist);
          }
          else {
            console.log('here 2');
            filelist.push(file);
          }
        });
        filelist = filelist.map(file => path.resolve(file));
        var map = {}
        rSource.forEach(file => map[file] = true)
        console.log('mappp', map)
        var unused = filelist.filter(file => map[file] !== true);
        console.log('unused', unused);
        fs.writeFile('./output.txt', unused);
        // console.log('here', filelist.sort().reverse())
});