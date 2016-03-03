import {enums} from './../../../../bl/module.js';

angular
    .module('rad.shop')
    .directive('radShopPopups', radShopPopups);

radShopPopups.$inject = ['$templateCache'];

function radShopPopups($templateCache) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/shop/directives/radShopPopups/radShopPopups.html',
        controller: radShopPopupsController,
        link: link,
        scope: {
            popup: '='
        }
    };
}

radShopPopupsController.$inject = ['$scope'];
function radShopPopupsController($scope){
    $scope.viewType = '';
    var popupType = $scope.popup.type;

    $scope.closePopup = function(){
        $scope.viewType = false;
    };

    $scope.close = function(){
        console.log('close');
        $scope.popup.isOpen = false;
    }
}

function link(scope, attrs) {

}