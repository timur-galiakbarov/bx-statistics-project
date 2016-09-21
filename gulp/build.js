var gulp = require('gulp');
var browserSync = require("browser-sync");
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var reload = browserSync.reload;
var runSequence = require('gulp-run-sequence');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var ftp = require('gulp-ftp');
var gutil = require('gulp-util');

var config = require('./config.js');
var path = require('./path.js');

gulp.task('html:build', function () {
    return gulp.src([path.src.html, '!'+path.src.dir+'index.html']) //Выберем файлы по нужному пути
        .pipe(gulp.dest(path.build.html)) //Выплюнем их в папку build
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('indexHtml:build', function () {
    return gulp.src(path.src.dir+'index.html') //Выберем файлы по нужному пути
        .pipe(gulp.dest(path.build.dir)) //Выплюнем их в папку build
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('css:build', function () {
    return gulp.src(path.src.css) //Выберем файлы по нужному пути
        .pipe(concat('commonStyles.css'))
        .pipe(gulp.dest(path.build.css)) //Выплюнем их в папку build
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('libcss:build', function () {
    return gulp.src(path.src.libcss) //Выберем файлы по нужному пути
        .pipe(concat('libStyles.css'))
        .pipe(gulp.dest(path.build.css)) //Выплюнем их в папку build
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('js:build', function () {
    return browserify({entries: path.src.js, debug: true})
        .transform(babelify)
        .bundle()
        .pipe(source('bundle.js'))
        //.pipe(uglify()) //Сожмем наш js
        .pipe(gulp.dest(path.build.js)) //Выплюнем готовый файл в build
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('libjs:build', function () {
    return gulp.src(path.src.libjs) //Выберем файлы по нужному пути
        .pipe(concat('libScripts.js'))
        .pipe(gulp.dest(path.build.js))
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('js:tplbuild', function () {
    return gulp.src(path.src.tpljs) //Выберем файлы по нужному пути
        .pipe(gulp.dest(path.build.tpljs)) //Выплюнем их в папку build
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

gulp.task('fonts:build', function () {
    return gulp.src(path.src.fonts)
        .pipe(gulp.dest(path.build.fonts))
});

gulp.task('images:build', function () {
    return gulp.src(path.src.images)
        .pipe(gulp.dest(path.build.images))
});

gulp.task('build', ['bower_components'], function (done) {
    return runSequence(
        'indexHtml:build',
        'html:build',
        'libcss:build',
        'css:build',
        'libjs:build',
        'js:tplbuild',
        'js:build',
        'fonts:build',
        'images:build',
        done);
});