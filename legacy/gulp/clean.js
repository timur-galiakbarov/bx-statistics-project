var gulp = require('gulp');
var rimraf = require('rimraf');

var path = require('./path.js');
var config = require('./config.js');

/*gulp.task('clean:bxbower', function(cb){
    return rimraf('./../bower_components/',cb);
});*/

gulp.task('clean:bxdata', function(cb){
    return rimraf(path.bitrix.dir, cb);
});

/*gulp.task('clean:bx', function(cb){
    return runSequence('clean:bxbower', 'clean:bxdata', 'clean:bxindex', cb);
});*/

gulp.task('clean', function (cb) {
    if (config.buildBitrix){
        return gulp.series('clean:bxdata', cb);
    } else {
        return rimraf(path.clean, cb);
    }
});
