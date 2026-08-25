const gulp = require('gulp');
const browserSync = require("browser-sync");
const concat = require('gulp-concat');
//const sourcemaps = require('gulp-sourcemaps');
const reload = browserSync.reload;
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const buffer = require('gulp-buffer');
const templateCache = require('gulp-angular-templatecache');
const minify = require("gulp-minify");
const path = require('./path.js');

gulp.task('html:build', function (cb) {
	return gulp.src([path.src.html, '!' + path.src.dir + 'index.html'])
		.pipe(templateCache('templates.js', {
			//module: 'templates',
			//base: "/"
		}))
		.pipe(gulp.dest(path.build.html))
		.pipe(reload({ stream: true }));
});

gulp.task('indexHtml:build', function () {
	return gulp.src(path.src.dir + 'index.html')
		.pipe(gulp.dest(path.build.dir))
		.pipe(reload({ stream: true }));
});

gulp.task('css:build', function () {
	return gulp.src(path.src.css)
		.pipe(concat('commonStyles.css'))
		.pipe(gulp.dest(path.build.css))
		.pipe(reload({ stream: true }));
});

gulp.task('libcss:build', function () {
	return gulp.src(path.src.libcss)
		.pipe(concat('libStyles.css'))
		.pipe(gulp.dest(path.build.css))
		.pipe(reload({ stream: true }));
});

gulp.task('js:build', function () {
	return browserify({ entries: path.src.js, debug: true })
		.transform(babelify.configure({
			presets: ["es2015"]
		}))
		.bundle()
		.pipe(source('bundle.js'))
		.pipe(buffer())
		.pipe(minify())
		.pipe(gulp.dest(path.build.js))
		.pipe(reload({ stream: true }));
});

gulp.task('commonjs:build', function () {
	return browserify({ entries: path.src.commonjs, debug: true })
		.transform(babelify.configure({
			presets: ["es2015"]
		}))
		.bundle()
		.pipe(source('common.js'))
		.pipe(buffer())
		.pipe(minify())
		.pipe(gulp.dest(path.build.commonjs))
		.pipe(reload({ stream: true }));
});

gulp.task('libjs:build', function () {
	return gulp.src(path.src.libjs)
		.pipe(concat('libScripts.js'))
		.pipe(buffer())
		.pipe(gulp.dest(path.build.js))
		.pipe(reload({ stream: true }));
});

gulp.task('js:tplbuild', function () {
	return gulp.src(path.src.tpljs)
		.pipe(buffer())
		.pipe(gulp.dest(path.build.tpljs))
		.pipe(reload({ stream: true }));
});

gulp.task('fonts:build', function () {
	return gulp.src(path.src.fonts)
		.pipe(gulp.dest(path.build.fonts));
});

gulp.task('images:build', function () {
	return gulp.src(path.src.images)
		.pipe(gulp.dest(path.build.images));
});

gulp.task('build_all:js', gulp.series(
	'commonjs:build',
	'libjs:build',
	'js:tplbuild',
	'js:build')
);

gulp.task('build_all:css', gulp.series(
	'libcss:build',
	'css:build')
);


gulp.task('build', gulp.series(
	'indexHtml:build',
	'html:build',
	'build_all:css',
	'build_all:js',
	'fonts:build',
	'images:build')
);
