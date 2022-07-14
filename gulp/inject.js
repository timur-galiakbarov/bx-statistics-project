const gulp = require('gulp');
const inject = require('gulp-inject');

const path = require('./path.js');
const { prefix } = path;

gulp.task('injectJs', function () {
	return gulp.src(path.build.dir + 'index.html')
		.pipe(inject(gulp.src(path.build.js + '*.js'),
			{
				name: 'app',
				transform: function (filepath, file, i, length) {
					return `<script src="${prefix}${filepath.replace(path.build.dir, '')}"></script>`;
				}
			}))
		.pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injectCss', function () {
	return gulp.src(path.build.dir + 'index.html')
		.pipe(inject(gulp.src(path.build.css + '*.css'), {
			name: 'template',
			transform: function (filepath, file, i, length) {
				return `<link rel="stylesheet" href="${prefix}${filepath.replace(path.build.dir, '')}" />`;
			}
		}))
		.pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injectHtml', function () {
	return gulp.src(path.build.dir + 'index.html')
		.pipe(inject(gulp.src(path.build.html + '*.js'), {
			name: 'templateJs',
			transform: function (filepath, file, i, length) {
				return `<script src="${prefix}${filepath.replace(path.build.dir, '')}"></script>`;
			}
		}))
		.pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injectCommonJs', function () {
	return gulp.src(path.build.dir + 'index.html')
		.pipe(inject(gulp.src(path.build.commonjs + '*.js'),
			{
				name: 'common',
				transform: function (filepath, file, i, length) {
					return `<script src="${prefix}${filepath.replace(path.build.dir, '')}"></script>`;
				}
			}))
		.pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injects', gulp.series(
	'injectCommonJs',
	'injectJs',
	'injectCss',
	'injectHtml')
);
