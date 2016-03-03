(function (module, _, $) {
	/*
	 Ниже небольшой туториал

	 1 на тег формы вешаем директиву b365-form
	 <form name="FORMNAME" b365-form>

	 2 на поля вешаем валидаторы. Примеры
	 -a <input type="text" name="FIELDNAME" ng-model="model.email"  b365-isolated-form b365-required="inviteFormVisible" b365-email="inviteFormVisible" />\
	 -b <textarea  b365-required name="FIELDNAME"  ng-model="taskModel.name"></textarea>
	 т.е можно просто указать правило b365-required ( b365-email), либо b365-required='needValidate'
	 в scope.needValidate - указывает нужно ли валидировать

	 3 если элемент лежит в директиве с изолированным скоупом, то добавляем атрибут b365-isolated-form (см пример 2.а)

	 4 Для отображения текстовок пишем так
	 - a. Для кастомной версти <span b365-validation-message for="FORMNAME.FIELDNAME.$error.required"><span for="Name" generated="true" class="">ТИПА КАСТОМНАЯ ВЕРСТКА ОФОРМЛЕНИЯ ОШИБКИ Введите наименование задачи</span></span>

	 -b либо default верстка
	 <span b365-validation-message="'Введите наименование задачи'" for=""FIELDNAME.required"></span>
	 <span b365-validation-message="'Введите наименование задачи'" for=""FIELDNAME.email"></span>

	 5. валидируем так
	 if ($scope.FORMNAME.validate()) {
	 doSave()
	 }

	 или

	 if ($scope.FORMNAME.validate(FIELDNAME)) {
	 doSaveFIELDNAME()
	 }

	 */

	module.directive("radForm", [function () {
		return {
			require: ['form', 'radForm'],
			link: {
				'pre': function (scope, formElement, attrs, cntrls) {

					//scope.currentFormName = attrs.name;

					//b365FormController.form = formController;

					var formController = cntrls[0];
					var radForm = cntrls[1];
					radForm.form = formController;
					if (!radForm.validators) {
						radForm.validators = [];
						formController.validators = radForm.validators;
					}


					formController.validate = function () {
						var wasError = false;
						for (var i = 0; i < radForm.validators.length; i++) {
							var item = radForm.validators[i];
							item.onValidate();
							//item.$validate();
							if (item.$valid || !item.isVisible()) continue;

							item.$setDirty();
							item.setError();
							if (!wasError) {
								item.setFocus();
								wasError = true;
							}

						}
						return !wasError;
					};

					formElement.bind('submit', function (event, fn) {
						if (!scope.$$phase) scope.$apply();
						if (!formController.$valid) return false;
						scope.$apply(function () {
							if (angular.isFunction(fn)) fn(scope, {$event: event});
						});

					});
				}
			},
			controller: function () {

			}
		};
	}]);
})(angular.module("rad.ui.directives"));