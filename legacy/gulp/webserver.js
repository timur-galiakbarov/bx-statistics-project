var gulp = require('gulp'),
    browserSync = require("browser-sync"),
    reload = browserSync.reload;


var config = require('./config.js');
gulp.task('webserver', function (cb) {
    browserSync(config)
    return cb;
});
