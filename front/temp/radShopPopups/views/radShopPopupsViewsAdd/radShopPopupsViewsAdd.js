import {enums} from './../../../../../../bl/module.js';
angular
    .module('rad.shop')
    .directive('radShopPopupsViewsAdd', radShopPopupsViewsAdd);

radShopPopupsViewsAdd.$inject = ['$templateCache'];

function radShopPopupsViewsAdd($templateCache) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/shop/directives/radShopPopups/views/radShopPopupsViewsAdd/radShopPopupsViewsAdd.html',
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
        console.log($scope.closePopup);
        $scope.closePopup();
    });

}

function link($scope) {

}