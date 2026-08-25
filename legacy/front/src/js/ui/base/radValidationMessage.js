/*
 Формат использования.
 <div radValidationTooltip for="name поля для которого выводится сообщение" invalid-css="class"  >
 <div rad-validation-message="текст сообщения 1" condition="условие 1"><div>
 <div rad-validation-message="текст сообщения 2" condition="условие 2"><div>
 .....
 <div rad-validation-message="текст сообщения n" condition="условие n"><div>
 </div>

 1. В атрибуте for  указываетcя значение аттрибута "name" поля для которого будет выводится сообщение
 2. В  invalid-css указывается класс для доп. подсветки поля при отрицательном  условии  condition
 */


(function (module) {


	module.directive("radValidationTooltip", ['$timeout', '$parse',function ($timeout, $parse) {
		return {
			restrict: 'A',
			require: 'radValidationTooltip',
			controller: ['$scope', function ($scope) {
				var messages = [];
				var renderObject;
				var self = this;

				this.registerMessage = function (val) {
					messages.push(val);
				};

				this.registerRender = function (val) {
					renderObject = val;
				};

				function testCondition() {
					var message;
					for (var i = 0; i <= messages.length - 1; i++) {
						if ($scope.$eval(messages[i].condition)) {
							message = messages[i];
							if (message.condition.indexOf('isShowError')>=0) message.isError=true; //это временный костыль
							break;
						}
					}
					return message;

				}

				function changeMessage(value) {
					if (value) {
						//$timeout(function () {
							renderObject.show(value.message(),value.isError);
						//}, 0);
						//if (renderObject.invalidCss)
						//	renderObject.element.addClass(renderObject.invalidCss);

					} else {
						renderObject.hide();
						//if (renderObject.invalidCss)
						//	renderObject.element.removeClass(renderObject.invalidCss);
					}
				}

				$scope.$watch(testCondition, changeMessage, true);
			}],
			link: function (scope, element, attr, ctrls) {
				var render = new getRender();

				var options = {
					placement: attr.placement ? attr.placement : "bottom",
					container: attr.container?attr.container:'',
					for: $parse(attr['for'])(scope) || attr['for'],
					selectorTooltip:attr.radTooltipSelector

				};

				render.init($('[name="' + attr['for'] + '"]'), options);
				render.invalidCss = (attr.invalidCss) ? attr.invalidCss : "";
				ctrls.registerRender(render);
			}
		};
	}]);


	module.directive("radValidationMessage", handleMessage);

	handleMessage.$inject = ['$compile'];
	function handleMessage($compile) {

		return {
			restrict: 'A',
			replace: true,
			transclude: true,
			require: '^radValidationTooltip',
			compile: function (element, attr) {
				return function link(scope, element, attr, ctrl, transcludeFn) {
					return transcludeFn(scope, function (element) {
						var message = getMessage(element, attr)(scope);
						ctrl.registerMessage({
							condition: attr.condition, message: function () {
								return message;
							}
						});
					});
				};

				function getMessage(element, attr) {
					var message;
					if (element.length === 0 || (element.length === 1 && element[0].nodeType === 3)) {
						message = attr.radValidationMessage;
						return function (scope) {
							return message;
						};
					} else {
						message = $('<div/>');
						angular.forEach(element, function (el, i) {
							message.append(el);
						});
						return function (scope) {
							return element;
						};
					}
				}
			}
		};
	}

	function getRender(index) {

		return {
			element: undefined,

			options: {
				title: '',
				placement: 'bottom',
				html: true,
				trigger: 'manual'
			},

			getElement: function () {
				if (this.options.selectorTooltip){
					return $(this.options.selectorTooltip);
				}
				return $('[name="' + this.options.for + '"]');
			},
			init: function (element, options) {
				//this.element = element;
				//if (this.element.tooltip){
				//    this.element.tooltip('destroy')
				//}
				$.extend(this.options, options)
				$(this.getElement()).tooltip(this.options);

			},
			show: function (message,isError) {
				this.changeMessage(message,isError);
				$(this.getElement()).tooltip('show');


			},
			hide: function () {
				$(this.getElement()).tooltip('hide');
			},
			changeMessage: function (message,isError) {

				this.hide();
				this.options.title = message;
				//$(this.element).tooltip('destroy').tooltip(this.options);
				var toolTip=$(this.getElement()).tooltip('destroy').tooltip(this.options);
				if (isError){
					toolTip.data('bs.tooltip').tip().addClass('error');
				}

			}
		};
	}


})(angular.module("rad.ui.directives"));
