import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .directive('radstatPopups', radstatPopups);

radstatPopups.$inject = ['$templateCache'];

function radstatPopups($templateCache) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/stat/directives/radStatPopups/radStatPopups.html',
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
        $scope.popup.isOpen = false;
    }
}

function link(scope, attrs) {

}
