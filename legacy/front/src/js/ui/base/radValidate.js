/**
 * Created by Azat Khalilov on 14.04.15.
 */

/**
 * Небольшой хелп
 *
 * Данная директива добавляет в ngModel дополнительные функции необходимы для валидации
 * Используется следуюшим образом <input ng-model name="" rad-validate>
 * Если элемент нужно валидировать, а он не input то пишем так <элемент ng-model name="" rad-validate rad-no-control> .После этого
 * модель появится в контроллере формы.
 *
 *
 */
(function (module) {

	module.directive('radValidate', radValidate);
	radValidate.$inject = ['$timeout'];
	function radValidate($timeout) {

		return {
			restrict: 'A',
			require: ['ngModel', '^radForm'],
			link: link
		};

		function link($scope, element, attrs, ctrls) {
			var ctrl = ctrls[0],
				radForm = ctrls[1];
			radForm.validators.push(ctrl);
			var notControl = ('radNotControl' in attrs);
			if (notControl) {
				radForm.form[attrs.name] = ctrl;
			}

			var inFocus = false,
				internalWasFocus = false;
			var validClass = attrs.validClass ? attrs.validClass : "success",
				invalidClass = attrs.invalidClass ? attrs.invalidClass : "error";

			var chanel = $({});

			ctrl.onValidate = function (cb) {
				if (typeof cb === 'function') {
					chanel.on('onvalidate', cb);
				} else {
					chanel.trigger('onvalidate', cb);
				}
			};

			ctrl.setElement = function (el) {
				if (element) {
					unsubscrcribeEnents();
				}

				if (el) {
					element = el;
					subscrcribeEnents();
				}
			};

			$scope.$on('$destroy', function () {
				chanel.off('onvalidate');
			});

			ctrl.isVisible = function () {
				return $(element).is(':visible') || !!$(element).attr('validate-invisible');
			};

			ctrl.inFocus = function () {
				return inFocus;
			};


			ctrl.isShowHint = function () {
				return ctrl.inFocus() && (ctrl.$valid || (ctrl.$pristine && !internalWasFocus));
			};

			ctrl.isShowError = function () {
				return ctrl.inFocus() && ctrl.$invalid && internalWasFocus;
			};


			ctrl.setFocus = function () {
				$(element).focus();
			};

			ctrl.setError = function () {
				internalWasFocus = true;
				this.setErrorClass();
			};

			ctrl.setErrorClass = function () {
				element.removeClass(validClass);
				element.addClass(invalidClass);
			};


			ctrl.setSuccesClass = function () {
				element.removeClass(invalidClass);
				element.addClass(validClass);
			};

			ctrl.clearError = function () {
				internalWasFocus = true;
				ctrl.setSuccesClass();
			};
			ctrl.clear = function () {
				element.removeClass(validClass);
				element.removeClass(invalidClass);
			};
			ctrl.clearState = function () {
				internalWasFocus = false;
				element.removeClass(invalidClass);
				element.removeClass(validClass);
			};

			ctrl.wasFocus = function () {
				return internalWasFocus;
			};

			$scope.$watch(function () {
				if (!notControl) {
					return ctrl.isShowError();
				}
				return ctrl.$viewValue;
			}, function (newValue) {
				if (notControl) {
					if (!internalWasFocus) return;
				} else {
					if (!ctrl.inFocus()) return;
				}

				if (!ctrl.isShowError()) {
					ctrl.setSuccesClass();
				} else {
					ctrl.setErrorClass();
				}

			}, true);

			ctrl.setElement(element);

			function subscrcribeEnents() {
				let focusoutTimer;
				let focusinTimer;

				element.on((notControl ? 'focusout' : 'blur') + '.radvalidate', function (e) {
					$timeout.cancel(focusinTimer);
					focusoutTimer = $timeout(()=> element && element.trigger('timeoutedfocusout'), 0);
				});

				element.on((notControl ? 'focusin' : 'focus') + '.radvalidate', function (e) {
					$timeout.cancel(focusoutTimer);
					focusinTimer = $timeout(()=>element && element.trigger('timeoutedfocusin'), 0);
				})

				element.on('timeoutedfocusin.radvalidate', (e)=> {
					inFocus = true;
				});

				element.on('timeoutedfocusout.radvalidate', (e)=> {
					if (ctrl.$invalid) {
						ctrl.setErrorClass();
					} else {
						ctrl.setSuccesClass();
					}
					inFocus = false;
					internalWasFocus = true;
				});
			}

			function unsubscrcribeEnents() {
				element.off('radvalidate');
			}
		}
	}
})(angular.module('rad.ui.directives'));