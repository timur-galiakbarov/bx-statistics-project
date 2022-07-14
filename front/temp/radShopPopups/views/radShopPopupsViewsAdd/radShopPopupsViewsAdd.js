import {enums} from './../../../../../../bl/module.js';
angular
    .module('rad.stat')
    .directive('radStatPopupsViewsAdd', radShopPopupsViewsAdd);

radShopPopupsViewsAdd.$inject = ['$templateCache'];

function radShopPopupsViewsAdd($templateCache) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/stat/directives/radStatPopups/views/radStatPopupsViewsAdd/radStatPopupsViewsAdd.html',
        controller: controller,
        link: link,
        scope: {
            openPopup: '=',
            closePopup: '='
        }
    };
}

controller.$inject = ['$scope'];
function controller($scope) {

    $("#modalAddItem").modal();//Jquery открытие модального окна
    $('#modalAddItem').on('hidden.bs.modal', function (e) {//Событие, вызываемое при закрытии окна
        $scope.closePopup();
    });

}

function link($scope) {

}
